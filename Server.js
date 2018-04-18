const HTTPS_PORT = process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 10000;
var server_ip_address = process.env.IP || process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0';

var express = require('express'),
https = require('https'),
app = express(),
fs = require('fs');
var http = require('http');
var forceSsl = require('express-force-ssl');
var parser = require('wrtc-ice-cand-parse');
var path=require('path');

var key = fs.readFileSync('cert/private.key');
var cert = fs.readFileSync( 'cert/domain.crt' );
var options = {
  key: key,
  cert: cert
};

var https_server = https.createServer(options, app);
var http_server = http.createServer(app);

// Now create socket io object.
var io = require('socket.io').listen(http_server);
https_server.listen(HTTPS_PORT);
http_server.listen(10001, server_ip_address, function(){
	console.log("app listening on: " server_ip_address + ':'+ HTTPS_PORT);
});
io.on('connection', function(socket){
  socket.on('join', function(room){
    var clients = io.sockets.adapter.rooms[room];
    console.log(clients);
    //https://github.com/googlecodelabs/webrtc-web/issues/5
    var numClients = (typeof clients !== 'undefined') ? Object.keys(clients.sockets).length : 0;
    if(numClients == 0){
      socket.join(room);
    }else if(numClients == 1){
      io.sockets.in(room).emit('join', room);
      socket.join(room);
      socket.emit('ready', room);
      socket.broadcast.emit('ready', room);
    }else{
      socket.emit('full', room);
    }
  });
  
  socket.on('candidate', function(candidate){
    var candObj = parser.parse(candidate);
    socket.broadcast.emit('candidate', candidate);
  });

  socket.on('offer', function(offer){
    socket.broadcast.emit('offer', offer);
  });

  // Relay answers
  socket.on('answer', function(answer){
    console.log("emitting answer other side");
    socket.broadcast.emit('answer', answer);
  });
  
  socket.on('signal', function(dummy){
    socket.broadcast.emit('signal', dummy);
  });

  socket.on('file', function(dummy){
    console.log("File sharing");
    socket.broadcast.emit('file', dummy);
  });
});

console.log(__dirname);
//app.use(express.static(path.join( __dirname + 'public')));
app.use(express.static('public'));
//app.use('/modules',express.static(__dirname + '/node_modules'));
app.get('/', function(req, res,next) {  
    res.sendFile(__dirname + '/public/index.html');
});

// To redirect the http trafic to https.
//app.use(forceSsl);
