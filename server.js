var http = require('http');
var url = require('url');
var io = require('socket.io');
var mongo = require('mongodb');
var async = require('async');
var CurseFilter = require('./curseFilter.js').CurseFilter;
var constants=require('./server_constants.js').constants;
var validate = require('./validate.js').validate;
var gameLoop = require('./game.js').gameLoop;

//Constants


function start(route,handle){

  //Collection of User Objects
  var userDb;

  //All session keys and associated clientside data. Kids, don't make your data structures this way.
  var sessions={
	__list:{},
	__EmailToKey:{},
	__size:0,
	insert:function(key,email,username,preferences,persistent){
	  if (this.has(key)){
		//Disallow key collisions
		return false;
	  }
	  if (this.__EmailToKey[email]){
		return this.__EmailToKey[email];
	  }
	  this.__list[key]={
		last_accessed:new Date(),
		email:email,
		username:username,
		preferences:preferences,
		command:{
		  move:[0,0],
		  shoot:false,
		  mouse:{
			click:false,
			position:[0,0],
		  },
		},
		persistent:persistent,
		sessionKey:key,
	  };
	  this.__EmailToKey[email]=key;
	  this.__size++;
	  return key;
	},
	remove:function(key){
	  if (!this.has(key)){
		return false;
	  }
	  this.__size--;
	  this.__EmailToKey.remove(__list[key].email);
	  __list.remove(key);
	  return true;
	},
	has:function(key){
	  return this.__list.hasOwnProperty(key);
	},
	get:function(key){
	  if (!this.has(key)){
		return false;
	  }
	  this.__list[key].last_accessed=new Date();
	  return this.__list[key];
	},
	purge:function(){
	  for (var i in this.__list){
	    if (!this.__list[i].persistent && new Date()-this.__list[i].last_accessed>constants.session_timeout){
		  //Kill session if it's not marked as persistent and last_accessed is older than session_timeout.
		  this.remove(i);
		}
	  }
	},
	size:function(){
	  return __size;
	},
	each:function(callback){
	  //Callback is in the form function(key,value)
	  for (var i in this.__list){
		callback(i,this.__list[i]);
	  }
	}
  };

  var langFilter;

  async.series([

	function printStarting(next){
	  console.log("Server starting...");
	  next();
	},

	function makeCurseFilter(next){
	  langFilter = new CurseFilter();
	  next();
	},

	function connectDb(next){
	  console.log('\tConnecting database...')
	  var dbServer = new mongo.Server(constants.hostname,constants.db_port,{auto_reconnect: true});
	  var db = new mongo.Db('GameData',dbServer,{w:1});
	  //Pointless comment
	  db.open(function(err,db){
		if (!err){
		  db.collection('Users',function(err, collection){
			if (!err){
			  userDb=collection;
			  console.log('\tDatabase successfully connected.');
			  next();
			}else{console.log(err);}
		  })
		}else{console.log(err);}
	  });
	},

	function startHTTP(next){
	  console.log("\tStarting http...")
	  var server = http.createServer(function(request,response){
		var pathname = url.parse(request.url).pathname;
		route(handle,pathname,response);
	  }).listen(constants.port,function(){
		console.log("\thttp started.")
		next();
	  });
	  io.listen(server, {log:false}).on('connection',function(socket){

		var isActive = false; //Records whether the current account is active. Set to true after setUp is called.

		//Listen to client
		
		//Login
		socket.on('login',function(data){
		  if (!validate(data,{email:'string',password:'string',persistent:'boolean'})){
			socket.emit('loginResult',{sessionId:false,error:'Data validation failed.'});
			console.log('Data validation failure at login.');
			return;
		  }
		  userDb.findOne({email:data.email},function(err,item){
			if (item && pwHash(data.password)==item.password){
			  //Successful Login
			  socket.emit('loginResult',{sessionKey:genSessionKey(sessions,item,data.persistent)})
			}else{
			  //Failed Login
			  socket.emit('loginResult',{sessionId:false, error:'Incorrect password.'});
			}
		  });
		});

		//Logout
		socket.on('logout',function(data){
		  if (!validate(data,{sessionKey:'string'})){
			console.log('Data validation failure at logout.');
			return;
		  }
		  //Invalidates Session
		  sessions.remove(data.sessionKey);
		});

		//NewUser
		socket.on('newUser',function(data){
		  if (!validate(data,{email:'string',username:'string',password:'string',password_confirmation:'string'})){
			socket.emit('createUserResult',{error:'Data validation failed.'});
			console.log('Data validation failure at newUser.');
			return;
		  }
		  if (!validateEmail(data.email)){
			//Invalid email
			socket.emit('createUserResult',{error:'Email is invalid.'})
		  }else if(data.password!=data.password_confirmation){
			//Invalid password
			socket.emit('createUserResult',{error:'Passwords do not match.'})
		  }else{
			userDb.findOne({email:data.email},function(err,item){
			  if (item){
				//Email already in database
				socket.emit('createUserResult',{error:'Email already in use.'})
			  }else{
				userDb.findOne({username:data.username},function(err,item){
				  if (item){
					//Username already in database
					socket.emit('createUserResult',{error:'Username already in use.'})
				  }else{
					//Create the user.
					userDb.insert({
					  email:data.email,
					  username:data.username,
					  password:pwHash(data.password),
					  preferences:{
						languageFilter:true, //No one wants to hear about 'yolo cs70 republican beiber swag' ever again.
					  }
					},{safe:true},function(err,result){
					  if (err){
						socket.emit('createUserResult',{error:'Internal server error. Something broke. We\'re sorry.'});  //TURING LIVES!
					  }else{
						socket.emit('createUserResult',{error:false,successMessage:'Your account has been created. An account confirmation email has been sent to ' + data.email+'.'});
					  }
					});
				  }
				});
		 
			  }
			});
		  }
		});

		//Allows user data retrieval
		socket.on('getUserData',function(data){
		  if (!validate(data,{key:'string'})){
			socket.emit('userData',{error:'Data validation failed.'});
			console.log('Data validation failure at getUserData.');
			return;
		  }
		  if (!sessions.get(data.key)){
			socket.emit('userData',{error:'Your session has expired. Please log in again.'}); 
		  }else{
			userDb.findOne({email:sessions.get(data.key).email},function(err,item){ //Ha. Made you look.
			  if (err){
				socket.emit('userData',{error:'Internal server error. Something broke. We\'re sorry.'});
			  }else{
				socket.emit('userData',{error:false,email:item.email,username:item.username});
			  }
			});
		  }
		});
	
		//Ingame Commands
		socket.on('command',function(data){
		  if (!validate(data,{sessionKey:'string',command:{move:['number','number'],shoot:'boolean',mouse:{click:'boolean',position:['number','number']}}})){
			socket.emit('userData',{error:'Data validation failed.'});
			console.log('Data validation failure at command.');
			return;
		  }
		  var session = sessions.get(data.sessionKey);
		  session.command=data.command;
		});

		socket.on('chat',function(data){
		  if (!validate(data,{sessionKey:'string',channel:'string',message:'string'})){
			console.log('Data validation failure at chat.');
			return;
		  }
		  //Check if user is logged on.
		  var user = sessions.get(data.sessionKey);
		  if (user){
			var msg={
			  sender:user.username,
			  channel:data.channel,
			  message:data.message,
			  timestamp:new Date(),
			};
			var filteredMsg={
			  sender:msg.sender,
			  channel:msg.channel,
			  message:langFilter.filterPhrase(msg.message),
			  timestamp:msg.timestamp,
			}
			sessions.each(function(sessionKey,session){
			  if (session.socket){
				//TODO: Add additional conditions, such as team, privacy, language filtering, etc.
				if (session.preferences.languageFilter){
				  session.socket.emit('chat',filteredMsg);
				}else{
				  session.socket.emit('chat',msg);
				}
			  }
			});
		  }
		});

		//Important: Call this before starting the game instance.
		//Will record socket data for each session, to allow back-and-forth communication.
		//Call on the game page, not on the login page..
		socket.on('setup',function(data){
		  if (!validate(data,{sessionKey:'string'})){
			console.log('Data validation failure at setup.');
			return;
		  }
		  sessions.get(data.sessionKey).socket=socket;
		  isActive=true;
		});


		//Send data back to client for drawing
		
		setInterval(function(){
		  if (isActive){
			socket.emit('gameBoard',{'data goes':'here'});
		  }
		},constants.gameRefresh);

	  });
	},
	function startPurgeProcess(next){
	  setInterval(sessions.purge,60000);
	  next();
	},
	function startGameLoop(next){
	  setInterval(function(){gameLoop(sessions);},15);
	  next();
	},
	function finish(){
	  console.log("Server started.");
	  console.log("Listening at http://localhost:1759");
	  console.log("Press Ctrl-c to stop.");
	}
  ])
}

//Helper functions

function validateEmail(email) { 
  var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(email);
} 

function pwHash(pw){
  //Goes "Hashy hashy."
  var hash=0;
  for (var i = 0; i < pw.length; i++){
	hash+=pw.charCodeAt(i)*Math.pow(0x10,i)%70368760954879;
  }
  return hash;
}

function genSessionKey(sessions,item,persistent){
  var key;
  do{
	//Randomize crap! It's 3:20AM! feel free to make this work better.
	key=sessions.insert(pwHash(item.username+item.email).toString(16)+((Math.round(Math.random()*70368760954879)+Number(new Date()))%70368760954879).toString(16),item.email,item.username,item.preferences,persistent)
  }while(!key);
  return key;
}

exports.start=start;




/**
 *
 * Here lies a toppled god.
 * His fall was not a small one.
 * We did but build his pedestal,
 * A narrow and a tall one.
 *                            --H.G. Wells
 *
 */


