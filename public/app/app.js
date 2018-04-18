var dataChannel = null;
var VideoChat = {
  //Initialize connection to Socket IO signaling server.
  socket: io(),

  requestMediaStream: function(event){
    navigator.getUserMedia(
      {video: true, audio: true},
      VideoChat.onMediaStream,
      VideoChat.noMediaStream
    );
  },
 
  onMediaStream: function(stream){
    VideoChat.receiveBuffer = [];
    VideoChat.receivedSize = 0;
    VideoChat.localVideo = document.getElementById('localVideo');
    VideoChat.localVideo.volume = 0;
    VideoChat.localStream = stream;
    VideoChat.videoButton.setAttribute('disabled', 'disabled');
    VideoChat.localVideo.srcObject = stream;
    // Join the room for signaling.
    VideoChat.socket.emit('join', 'test');
    VideoChat.socket.on('ready', VideoChat.readyToCall);
    VideoChat.socket.on('offer', VideoChat.onOffer);
    VideoChat.socket.on('candidate', VideoChat.onCandidate);
    VideoChat.socket.on('signal', VideoChat.onSignal);
    VideoChat.socket.on('file', VideoChat.onFileUpload);
  },
 
  noMediaStream: function(){
    console.log("No media stream for us.");
  },

  readyToCall: function(event){
    console.log("Inside ready to call");
    VideoChat.callButton.removeAttribute('disabled');
      
  },

  sendFile: function(){
    var fileInput = document.getElementById("fileInput");
    var file = fileInput.files[0];
    
    var fileInfo = {"name" : file.name, "size" : file.size, "type" : file.type};  
    VideoChat.socket.emit("file", JSON.stringify(fileInfo));

    var chunkSize = 16384;
    var reader = new window.FileReader();
    
    reader.onload = (function(file){
      return function(e){
            console.log("data sent = "+reader.result);
            if (VideoChat.dataChannel.readyState === 'open'){         
             VideoChat.dataChannel.send(reader.result);
           }
      };
      })(file);

    reader.readAsText(file);
  },

  onFileUpload: function(fileInfo){
    VideoChat.recvFileInfo = fileInfo;
    console.log(VideoChat.recvFileInfo);
      alert('Received File' + VideoChat.recvFileInfo.name);
  },
  
  onSendChannelStateChange: function() {
    var readyState = dataChannel.readyState;
    console.log('Send channel state is: ' + readyState);  
  },

  openDataChannel: function(){
    var dataChannelOptions = {
      reliable: true,
      maxRetransmitTime: "2000"
    };

      VideoChat.endcallButton.removeAttribute('disabled');
    VideoChat.dataChannel = VideoChat.peerConnection.createDataChannel('testDataChannel',dataChannelOptions);
    
    VideoChat.dataChannel.binaryType = 'arraybuffer';
    console.log('Created send data channel');

    VideoChat.dataChannel.onopen = function(event){
      console.log("Data channel open");
    };

    VideoChat.dataChannel.onclose = function(event){
      console.log(event);
    };
    VideoChat.dataChannel.onerror = function(event){
      console.log(event);
    };

  },
  
  onMessageCallBack: function(event){
    console.log(event.data);
    VideoChat.receiveBuffer.push(event.data);
    console.log(event.data.length);
    VideoChat.receivedSize += event.data.length;
    var fileInfo = JSON.parse(VideoChat.recvFileInfo);
    if (VideoChat.receivedSize === fileInfo["size"]) {
      var received = new window.Blob(VideoChat.receiveBuffer);
      VideoChat.receiveBuffer = [];
      VideoChat.downloadAnchor.href = URL.createObjectURL(received);
      VideoChat.downloadAnchor.download = fileInfo["name"];
      VideoChat.downloadAnchor.textContent =
      'Click to download \'' + fileInfo["name"] + '\' (' + fileInfo["size"] + ' bytes)';
      VideoChat.downloadAnchor.style.display = 'block';
    }    
  },

  ondatachannelcallback: function(event){
     VideoChat.recvChannel = event.channel;
     VideoChat.recvChannel.onopen = function(event){
        console.log("Data channel open on recv side");
      };
     VideoChat.recvChannel.onmessage = VideoChat.onMessageCallBack;
     VideoChat.recvChannel.onerror = function(error){
        console.log("Error: "+error);
      };
     VideoChat.recvChannel.onclose = function(event){
        console.log("Data channel close on recv side");
      };
  },

  initializePeerConn: function(event){
    peerConnCfg = {"iceServers":[{"urls":"turn:numb.viagenie.ca", "username":"gandharpatwardhan@s2pedutech.com", "credential":"gandhar"}],"iceTransportPolicy":"all","iceCandidatePoolSize":"0"};
    VideoChat.peerConnection = new RTCPeerConnection(peerConnCfg);
    VideoChat.peerConnection.ondatachannel = VideoChat.ondatachannelcallback;
    VideoChat.peerConnection.addStream(VideoChat.localStream);

    VideoChat.peerConnection.onicecandidate = VideoChat.onIceCandidate;
    
    VideoChat.peerConnection.onaddstream = VideoChat.onAddStream;
    VideoChat.openDataChannel();
  },

  startCall: function(event){
    console.log("Starting call...");
    VideoChat.initializePeerConn();
    VideoChat.socket.emit('signal','test');
    VideoChat.socket.on('answer', VideoChat.onAnswer);
    VideoChat.createOffer();

  },
    endCall: function(event){
    console.log("Ending call...");
    //VideoChat.initializePeerConn();
    //VideoChat.socket.emit('signal','test');
    //VideoChat.socket.on('answer', VideoChat.onAnswer);
    //VideoChat.createOffer();
        VideoChat.peerConnection.close();

  },

  onIceCandidate: function(event){
    if(event.candidate){
      VideoChat.socket.emit('candidate', JSON.stringify(event.candidate));
    }
  },

  onCandidate: function(candidate){
    rtcCandidate = new RTCIceCandidate(JSON.parse(candidate));
    VideoChat.peerConnection.addIceCandidate(rtcCandidate);
  },

  onSignal: function(dummy){
    VideoChat.initializePeerConn();
  },
  
  setMediaBitrates: function(sdp) {
    return VideoChat.setMediaBitrate(VideoChat.setMediaBitrate(sdp, "video", 150), "audio", 120);
  },
 
  setMediaBitrate: function(sdp, media, bitrate) {
    var lines = sdp.split("\n");
    var line = -1;
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].indexOf("m="+media) === 0) {
        line = i;
        break;
      }
    }
    if (line === -1) {
      console.debug("Could not find the m line for", media);
      return sdp;
    }
     
    line++;
 
    // Skip i and c lines
    while(lines[line].indexOf("i=") === 0 || lines[line].indexOf("c=") === 0) {
      line++;
    }
 
    // If we're on a b line, replace it
    if (lines[line].indexOf("b") === 0 ){
      lines[line] = "b=AS:"+bitrate;
      return lines.join("\n");
    }
  
    // Add a new b line
    var newLines = lines.slice(0, line)
    newLines.push("b=AS:"+bitrate)
    newLines = newLines.concat(lines.slice(line, lines.length))
    return newLines.join("\n")
  },
  
  createOffer: function(){
    VideoChat.peerConnection.createOffer(
      function(offer){
        
        VideoChat.peerConnection.setLocalDescription(offer);
        
        // Limit bandwidth.
        offer.sdp = VideoChat.setMediaBitrates(offer.sdp);
        console.log("The modified offer sdp is" + offer.sdp);
        VideoChat.socket.emit('offer', JSON.stringify(offer));
      },
      function(err){
        // Handle a failed offer creation.
        console.log(err);
      }
    );
  },

  createAnswer: function(offer){
    rtcOffer = new RTCSessionDescription(JSON.parse(offer));
      VideoChat.peerConnection.setRemoteDescription(rtcOffer);
      VideoChat.peerConnection.createAnswer(
        function(answer){
          VideoChat.peerConnection.setLocalDescription(answer); 
          
          answer.sdp = VideoChat.setMediaBitrates(answer.sdp);
          console.log("Modified answer sdp is " + answer.sdp);

          VideoChat.socket.emit('answer', JSON.stringify(answer));
        },
        function(err){
          // Handle a failed answer creation.
          console.log(err);
        }
      );
  },

  onOffer: function(offer){
    console.log("Offer Recieved");
    VideoChat.createAnswer(offer);
  },

  onAnswer: function(answer){
    console.log('answer Recieved');
    var rtcAnswer = new RTCSessionDescription(JSON.parse(answer));
    VideoChat.peerConnection.setRemoteDescription(rtcAnswer);
  },

  onAddStream: function(event){
    console.log("Inside add stream");
    VideoChat.remoteVideo = document.getElementById('remoteVideo');
    VideoChat.remoteVideo.srcObject = event.stream;
  }
};
 
VideoChat.videoButton = document.getElementById("get-video");
VideoChat.callButton = document.getElementById("call");
VideoChat.endcallButton = document.getElementById("endcall");
VideoChat.sendFileButton = document.getElementById("sendFileButton");
VideoChat.downloadAnchor = document.getElementById("download");
 
VideoChat.videoButton.addEventListener(
  'click',
  VideoChat.requestMediaStream,
  false
);

VideoChat.callButton.addEventListener(
  'click',
  VideoChat.startCall,
  false 
);
VideoChat.endcallButton.addEventListener(
  'click',
  VideoChat.endCall,
  false 
);

VideoChat.sendFileButton.addEventListener(
  'click',
   VideoChat.sendFile,
   false
);