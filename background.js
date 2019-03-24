//chrome.browserAction.onClicked.addListener(click);
chrome.alarms.create({periodInMinutes: 1});

function addToStorage(channel, type, callback){
	// Type = 0 Follow
	// Type = 1 Unfollow
	// Type = 2 Enable Single Notifications
	// Type = 3 Disable Single Notifications
	var streamers;
	chrome.storage.local.get({streamers:{}, 'notifications':true}, function (result) {
		streamers = result.streamers;
		if (type == 1){
			delete streamers[channel];
		}
		else if (type == 0)
			streamers[channel] = {flag:0,url:"null",game:"null",viewers:-1,created_at:"null",title:"null",notify:result.notifications};
		else if (type == 2)
			streamers[channel].notify=true
		else if (type == 3)
			streamers[channel].notify=false
		chrome.storage.local.set({'streamers': streamers}, function () {
			var opt;
			if (type == 1){
				opt = {
				  type: "basic",
				  title: "NowStreaming",
				  message: "You unfollowed "+channel+"!",
				  iconUrl: "cross.png"
				}
			}
			else if (type == 0){
				opt = {
				  type: "basic",
				  title: "NowStreaming",
				  message: "You are now following "+channel+"!",
				  iconUrl: "check.png"
				}
			}
			if(result.notifications && type < 2){
				chrome.notifications.clear((type==1?"un":"") + "follow"+channel+"-nstreaming", function(wasCleared) {});
				chrome.notifications.create((type==1?"un":"") + "follow"+channel+"-nstreaming", opt, function(id) {updateCore(0,function(){callback();}); });
			}
			else{
				updateCore(0,function(){callback();});
			}
		});
	});
}

function isEmpty(map) {
   for(var key in map) {
      if (map.hasOwnProperty(key)) {
         return false;
      }
   }
   return true;
}

chrome.runtime.onStartup.addListener(function() {
	chrome.storage.local.get({streamers:{}, 'notifications':true}, function (result) {
		streamers = result.streamers;
		for (var key in streamers){
			if (streamers[key].notify == null) {
				streamers[key] = {
					flag: 1,
					game: "null",
					viewers: -1,
					url: "null",
					created_at: "null",
					title: "null",
					notify: result.notifications
				};
			} else{
				streamers[key] = {
					flag: 1,
					game: "null",
					viewers: -1,
					url: "null",
					created_at: "null",
					title: "null",
					notify: streamers[key].notify
				};
			}
		}
		//console.log(streamers);
		chrome.storage.local.set({'streamers': streamers}, function () {
			//console.log("Meti isto ^ no local ");
			updateCore(1,function(){});
		});
	});
});

chrome.runtime.onUpdateAvailable.addListener(function (){
	chrome.runtime.reload();
});

chrome.runtime.onInstalled.addListener(function () {
	chrome.storage.local.get({streamers:{},'notifications':true,'add':true}, function (result) {
		streamers = result.streamers;
		for (var key in streamers){
			if (streamers[key].notify == null) {
				streamers[key] = {
					flag: 1,
					game: "null",
					viewers: -1,
					url: "null",
					created_at: "null",
					title: "null",
					notify: result.notifications
				};
			} else{
				streamers[key] = {
					flag: 1,
					game: "null",
					viewers: -1,
					url: "null",
					created_at: "null",
					title: "null",
					notify: streamers[key].notify
				};
			}
		}
		//console.log(streamers);
		chrome.storage.local.set({'streamers': streamers,'notifications':result.notifications,'add':result.add}, function () {
			updateCore(1,function(){});
		});
	});
});

chrome.notifications.onClicked.addListener(function(notificationId) {
        if (notificationId.split("-")[1] != "nstreaming"){
                chrome.tabs.create({url: notificationId.split('-')[1]});
        }
});

chrome.notifications.onButtonClicked.addListener(function(notifId, btnIdx) {
	if (btnIdx === 0) {
		addToStorage(notifId.split('-')[0],1,function(){});
	}
});

chrome.alarms.onAlarm.addListener(function() {
	updateCore(0,function(){});
});

function getFollowing(){
	chrome.storage.local.get({streamers:{}}, function (result) {
		streamers = result.streamers;
	});
}

function twitchAPIBackgroundCall(type, channels){
	var appClientID = "tn2qigcd7zaj1ivt1xbhw0fl2y99c4y";
	var acceptVersion = "application/vnd.twitchtv.v5+json";
	switch(type){
		case 0:
			// User to IDs
			var url = "https://api.twitch.tv/kraken/users/?login="+channels
			break;
		case 1:
			// Get streams
			var url = "https://api.twitch.tv/kraken/streams?limit=100&channel="+channels
	}
	return $.ajax({
		url : url,
		headers: {
			'Client-ID': appClientID,
			'Accept': acceptVersion
		},
		dataType: "json",
		type: 'GET'
	});
}

function getUserIDBatch(result){
	ids = []
	for (var i in result.users){
		ids.push(result.users[i]._id);
	}
	return ids;
}

function updateCore(is_first_run,callback) {
	var json;
	var streamers = {};
	temp = [];

	/*Load streamers*/
	chrome.storage.local.get({streamers:{},'notifications':true}, function (result) {
		streamers = result.streamers;
		//console.log(streamers);

		/* Not following anyone? Don't do anything */

		if (isEmpty(streamers)){
			chrome.browserAction.setBadgeText({"text": ""});
			callback();
			return;
		}

		/* Add streamers to URL so we can send them all in one request */
		var urlAppend="";
		var count=0;
		var idsArray=[];
		var streamersArray=Object.keys(streamers);
		var processedCalls=0;
		var totalCalls = Math.ceil(streamersArray.length/100);
		streamersArray.forEach(function(listItem, index){
			urlAppend+=listItem+",";
			if ( (index != 0 && index % 99 == 0) || index == streamersArray.length - 1){
				twitchAPIBackgroundCall(0, urlAppend.slice(0,-1)).done(function (json) {
					idsArray = $.merge(idsArray, getUserIDBatch(json));
					processedCalls++;
					if (totalCalls == processedCalls){
						getStreams();
					}
				});
				urlAppend = "";
			}
		});

		function getStreams(){
			var urlAppend="";
			for (var i = 0; i < idsArray.length; i++){
				urlAppend+=idsArray[i]+",";
			}
			twitchAPIBackgroundCall(1, urlAppend.slice(0,-1)).done(function (json) {
				var onlineStreams=0;
				/* If anyone is streaming then this loop will run */
				//console.log(json);
				//console.log("Length: "+json.streams.length+" e "+json._total);
				for (i=0;i<json.streams.length;i++){
					/* We will need this temp so we can check which streamers are NOT streaming in the end */
					temp.push(json.streams[i].channel.name);
					onlineStreams++;
					/* If stream is up and notification has not been sent, then send it */
					if (result.notifications && !is_first_run && streamers[json.streams[i].channel.name].flag == 0 && (streamers[json.streams[i].channel.name].created_at != json.streams[i].created_at) && streamers[json.streams[i].channel.name].notify){
						//console.log("A mandar not do "+json.streams[i].channel.name);
						tmpname = json.streams[i].channel.name;
						tmpurl = json.streams[i].channel.url;
						var opt = {
						  type: "basic",
						  title: "Live: "+json.streams[i].channel.display_name,
						  message: "Game: "+(json.streams[i].game!=null?json.streams[i].game:"N/A")+"\n"+"Viewers: "+json.streams[i].viewers,
						  contextMessage: "Click to watch the stream",
						  buttons:[{title:"Unfollow "+json.streams[i].channel.display_name,iconUrl:"cross.png"}],
						  iconUrl: json.streams[i].channel.logo!=null?json.streams[i].channel.logo:"icon.png",
						  isClickable: true
						}
						chrome.notifications.clear(tmpname+"-"+tmpurl, function(wasCleared) {});
						chrome.notifications.create(tmpname+"-"+tmpurl, opt, function(id){});
					}
					streamers[json.streams[i].channel.name].game = json.streams[i].game!=null?json.streams[i].game:"N/A";
					streamers[json.streams[i].channel.name].viewers = json.streams[i].viewers!=null?json.streams[i].viewers:"?";
					streamers[json.streams[i].channel.name].title = json.streams[i].channel.status!=null?json.streams[i].channel.status:"?";
					streamers[json.streams[i].channel.name].url = json.streams[i].channel.url!=null?json.streams[i].channel.url:"https://twitch.tv/"+json.streams[i].channel.name;
					streamers[json.streams[i].channel.name].created_at = json.streams[i].created_at!=null?json.streams[i].created_at:"?";
					streamers[json.streams[i].channel.name].flag = 1;
				}

				/* Check which ones were not streaming so we reset values */
				for (var key in streamers){
					if (temp.indexOf(key) == -1){
						//console.log("Meti alguem a 0 -"+key);
						streamers[key].flag = 0;
					}
				}
				chrome.storage.local.set({'streamers': streamers}, function () {
					chrome.browserAction.setBadgeBackgroundColor({"color": (onlineStreams==0?"#B80000":"#009933")});
					chrome.browserAction.setBadgeText({"text": ""+onlineStreams});
				callback();
				});
			});
		}
	});
}
