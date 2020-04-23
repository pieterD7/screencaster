class Screencaster{

    constructor(){
        
        this.settings = new JSProxy( 
            {
                // Picture in picture
                pInP: false,

                usePiPAPI: false,
            
                // Use avatar instead of webcam
                useAvatarInPInP: false,
            
                // Color names or codes for foreground and background of the name at the bottom of the pInP. 
                // Set to false if you don't want text in the picture.
                drawNameAtBottomPInP: { fg: 'white', bg: 'red' },
            
                // Microphone playback
                headset: false,
            
                // Devices to use. 
                // Only makes sense whith pInP == true together with useAvatar == false, or headset == false
                useDefaultDevices: true,
            
                // Collect 100ms of data
                samplesMillis: 100, 
                
            }, {
                pInP : 'boolean', 
                usePiPAPI: 'boolean',
                useAvatarInPInP : 'boolean',
                drawNameAtBottomPInP: 'boolean|object',
                headset: 'boolean',
                useDefaultDevices: 'boolean',
                samplesMillis: 'number|>50|<2000',
            }, 
            
            'types', 
            
            () => { this.syncInterface() }, 
            
            ( error ) => { this.errorMsg = error }
        )

        this.html = new JSProxy( 
            {

                // The container
                recorder: null,

                // The video tag for playing the video after recording
                canvas: null,

                // The start / stop button
                btnStart: null,

                // The download button
                btnDownload: null,

                // The test microphone button
                btnTestMic: null,

                // The test webcam button
                btnTestWebCam: null,

                // The audiolevel meter tag
                mtrAudioLevel: null,

            },{
                canvas: 'video',
                recorder: 'div',
                btnStart: 'button',
                btnPause: 'button',
                btnDownload: 'button',
                btnTestWebCam: 'button',
                btnTestMic: 'button',
                mtrAudioLevel: 'meter'
            }, 
            
            'tags', 
            
            null, 
            
            ( error ) => { this.errorMsg = error }
        )

        this.merger = null
        this.videoIn = false
        this.streamsIn = []
        this.streamOut = null
        this.mediaRecorder
        this.recordedBlobs
        this.soundMeter
        this.soundMeterTimer
        this.audioInputDevices = []
        this.videoInputDevices = []
        this.audioConstraints = {
            echoCancellation: true,
            noiseSuppression: true, 
            sampleRate: 44100
        },
        this.videoConstraints = true
        this.testWebcam = false
        this.errorMsg = '';
    }

    getUserLanguagePreference(){
        let uaLang = navigator.languages[ 0 ].substring(0, 2);
        if( uaLang == 'en') return 'en'
        else if( uaLang == 'nl') return 'nl'
        return 'en'
    }

    init(){

        this.html.btnDownload.disabled = true

        this.html.btnStart.addEventListener( 'click', () => { this.toggleVideoIn() } )
        this.html.btnPause.addEventListener( 'click', () => { this.pauseRecording() } )
        this.html.btnDownload.addEventListener( 'click', () => { this.download() } )
        this.html.btnTestMic.addEventListener( 'click', () => { this.toggleTestMic() })
        this.html.btnTestWebCam.addEventListener( 'click', () => { this.toggleTestWebCam() } )
        //this.html.canvas.addEventListener( 'play', this.soundLevelVideoStream)

        this.html.btnPause.disabled = true

        window.addEventListener('DOMContentLoaded', () => {
            let lang = langs[ this.getUserLanguagePreference() ]

            if( typeof AudioContext  == 'undefined' ){
                window.AudioContext = window.webkitAudioContext
            }

            for( var prop in lang){

                let el = document.querySelector( prop )
                if( el )
                    el.innerText = lang[ prop ]
            }

            this.validSettings()
            .catch( (e) => {
                this.errorMsg = e
            })
        })
    }

    syncInterface(){

        if( this.settings.pInP){
            this.html.btnTestWebCam.disabled = false
        }
        else{
            this.html.btnTestWebCam.disabled = true
        }
    }

    setButtonsTest( bool ){
        let btns = document.querySelectorAll('.column:nth-child(2) button#btnStart'),
            div = document.querySelector( '.test' );
        if( btns ){
            btns.forEach( (btn) => {
                btn.disabled = bool
            })
        }

        if( div ){
            if( bool )
                div.classList.add( 'recording' )
            else
                div.classList.remove( 'recording' )
        }
    }

    setButtonsrecording( bool ){
        let btns = document.querySelectorAll('.column:nth-child(1) button'),
            div = document.querySelector( '.record' );

        if( btns ){
            btns.forEach( (btn) => {
                btn.disabled = bool
            })
        }
        if( div ){
            if( bool )
                div.classList.add( 'recording' )
            else
                div.classList.remove( 'recording' )
        }
    }

    validSettings(){

        return new Promise( ( resolve, reject ) => {
            let satisFy = [];

            if( ! this.settings.headset )
                satisFy.push( 'audio' )
        
            if( this.settings.pInP && ! this.settings.useAvatarInPInP )
                satisFy.push( 'video' )

            this.audioInputDevices = []
            this.videoInputDevices = []
            
            let o = this,
                iterator = function( device ){

                    let kind = device.kind.toLowerCase()

                    if(  kind == 'audioinput' ){
                        if( ! o.settings.audioDeviceId )
                            o.settings.audioDeviceId = device.deviceId
                        o.audioInputDevices.push( device )
                        if( satisFy.indexOf( 'audio' ) > -1)
                            satisFy.splice( satisFy.indexOf( 'audio' ), 1 )
                    }
                    else if( kind == 'videoinput'){
                        if( ! o.settings.videoDeviceId )
                            o.settings.videoDeviceId = device.deviceId
                        o.videoInputDevices.push( device )
                        if ( satisFy.indexOf( 'video' ) > -1)
                            satisFy.splice( satisFy.indexOf( 'video' ), 1 )
                    }
                }

            if( ! navigator.mediaDevices ) return reject( "navigator.mediaDevices is undefined" )

            navigator.mediaDevices.enumerateDevices()
            .catch( (e) => {
                this.errorMsg = e
                return reject( e )
            })
            .then( ( devices ) => {
                if( devices instanceof Array)
                    devices.forEach( ( device ) => iterator( device ) )
            })
            .then( () => {
                if( satisFy.length != 0)
                    return reject( 'Settings are not applicable to the hardware : ' + satisFy.join(' ') 
                        + '. Settings : ' + JSON.stringify( this.settings ))
            }) 
            .then( () => {
                resolve( 'ok' )
            })
        })
    }

    hasPiPAPI(){
        
        return document.pictureInPictureEnabled
    }

    getVideoConstraints(){
        if( this.settings.useDefaultDevices || ! this.settings.videoDeviceId ){
            return this.videoConstraints
        }
        else{
            return {
                deviceId: this.settings.videoDeviceId
            }
        }
    }

    getAudioConstraints(){
        
        if( this.settings.useDefaultDevices || ! this.settings.audioDeviceId){
            return this.audioConstraints
        }
        else{
            return {
                deviceId: this.settings.audioDeviceId
            }
        }
    }

    soundLevelVideoStream(){
        let stream = document.querySelector( 'video' ).captureStream()
        if( stream ){
            this.streamsIn.push(stream)
            this.soundMeter = new SoundMeter(new AudioContext() );
            this.soundMeter.connectToSource(stream, (e) => {
                if (e) {
                    this.errorMsg = e
                    return;
                }
                this.soundMeterTimer = setInterval(() => {
                    console.log( this.soundMeter.instant.toFixed(2) )
                }, 200);
            });
        }
    }

    toggleTestMic(){

        if( ! this.videoIn ){
            this.validSettings()
            .catch( (e) => {
                this.errorMsg = e
            })
            .then( ( status ) => {

                if( status == 'ok' ){
                    this.testMic()
                    .catch( (e) => {
                        this.errorMsg = e
                        return
                    })
                    .then( ( result2 ) => {
    
                        if( result2 ){
    
                            this.videoIn = true
                            this.html.btnTestMic.blur()
                            this.html.btnStart.disabled = true
                            this.html.btnTestWebCam.disabled = true
                            let div = document.querySelector( '.test' )
                            if( div )
                                div.classList.add( 'recording' )
                        }
    
                    })
                }
            })
        }
        else{
            this.soundMeter.stop()
            this.stopRecording()
            clearInterval( this.soundMeterTimer )
            this.html.btnTestMic.blur()
            this.html.mtrAudioLevel.style.display = 'none'
            this.setButtonsTest( false )
            this.html.btnStart.disabled = false
            this.html.btnTestWebCam.disabled = false
            this.videoIn = false
            let div = document.querySelector( '.test' )
            if( div )
                div.classList.remove( 'recording' )
        }

    }

    openMicDisplayMedia(){
        return new Promise( ( resolve, reject) => {

            navigator.mediaDevices.getDisplayMedia( { video: true, audio: true } )
            .catch( (e) => {
                reject( e )
            }) 
            .then( ( stream ) => {
                resolve( stream )
            })
        })
    }
    
    openMicUserMedia(){

        return new Promise( ( resolve, reject) => {

            navigator.mediaDevices.getUserMedia( { video: false, audio: this.getAudioConstraints() } )
            .catch( (e) => {
                reject( e )
            }) 
            .then( ( stream ) => {
                resolve( stream )
            })
        })
    }

    testMic(){

        return new Promise( (resolve, reject ) => {
            let promise

            if( this.settings.headset )
                promise = this.openMicDisplayMedia()
            else
                promise = this.openMicUserMedia()
            
            Promise.resolve( promise  )
            .catch( ( e ) => { 
                this.errorMsg = e
                reject( e )
            })
            .then( ( stream ) => {

                if( stream ){
                    this.streamsIn.push(stream)
                    this.soundMeter = new SoundMeter(new AudioContext() );
                    this.soundMeter.connectToSource(stream, (e) => {
                        if (e) {
                            this.errorMsg = e
                            return;
                        }
                        this.html.mtrAudioLevel.style.display = 'inline-block'
                        this.soundMeterTimer = setInterval(() => {
                            this.html.mtrAudioLevel.value = this.soundMeter.instant.toFixed(2);
                        }, 200);
                    });
                }
    
            })
            .then( ( result ) => { 
                resolve( 'ok'  )
            } )
            .catch( ( e ) => {
                this.errorMsg = e
                reject( e )
            })
        })
    }

    toggleTestWebCam(){

        if( ! this.videoIn ){
            this.toggleTestVideoIn()
            .catch( ( e ) => {
                this.errorMsg = e
            })
        }
        else{
            this.toggleTestVideoIn()
            .catch( ( e ) => {
                this.errorMsg = e
            })
        }
    }

    mergeStreams(webcamStream, screenStream, nameStream){
    
        // Add the screen capture. Position it to fill the whole stream (the default)
        this.merger.addStream(screenStream, {
            x: 0, // position of the topleft corner
            y: 0,
            width: this.merger.width,
            height: this.merger.height,
            mute: true // we don't want sound from the screen (if there is any)
        })
        
        // Add the webcam stream. Position it on the bottom right and resize it to 100x100.
        this.merger.addStream(webcamStream, {
            x: this.merger.width - this.merger.width / 10 - 10,
            y: this.merger.height - this.merger.width / 10 - 50,
            width: this.merger.width / 10,
            height: this.merger.width / 10,
            mute: false
        })

        if( nameStream ){
            this.merger.addStream( nameStream, {
                x: this.merger.width - this.merger.width / 10 - 10,
                y: this.merger.height - this.merger.width / 10 - 76,
                width: this.merger.width / 10,
                height: this.merger.width / 40,
                mute: true
            } )
        } 
        
        // Start the merging. Calling this makes the result available to us
        this.merger.start()
        
        // We now have a merged MediaStream!
        //merger.result
    }

    startRecordingScreen(){
        return new Promise( (resolve, reject) => {

            navigator.mediaDevices.getDisplayMedia({
                video: true, 
                audio: this.settings.headset
            })
            .catch( ( e ) => { reject( e ) })
            .then( ( stream ) => { resolve( stream ) })
        } )
    }

    startRecordingWebCamMic(pInP, headset){
        return new Promise( (resolve, reject) => {
            navigator.mediaDevices.getUserMedia({video: pInP ? this.getVideoConstraints() : false, audio: ! headset } )
            .catch( ( e ) => { reject( e ) })
            .then( ( stream ) => { resolve( stream ) })
        })
    }

    startTestRecordingWebCam(){
        return new Promise( (resolve, reject) => {
            navigator.mediaDevices.getUserMedia( {video: this.getVideoConstraints(), audio: false} )
            .catch( ( e ) => { reject( e ) })
            .then( ( stream ) => { if( stream ) resolve( stream ) })
        })
    }

    startStreamFromNameCanvas(){
        return new Promise( (resolve, reject) => {
            var canvas = document.querySelector('#canvasName'), 
                ctx = canvas.getContext('2d');

            ctx.beginPath()
            ctx.fillStyle = this.settings.drawNameAtBottomPInP.bg
            ctx.fillRect(0, 0, canvas.width, canvas.height)

            ctx.fillStyle = this.settings.drawNameAtBottomPInP.fg
            ctx.font =  (canvas.height / 2) + 'px Arial'
            ctx.fillText(this.settings.personName, 2, canvas.height / 1.5)

            let stream = canvas.captureStream(25)
            
            resolve( stream)
        })
    }

    startStreamFromAvatarCanvas(){
        return new Promise( (resolve, reject ) => {
            var canvas = document.querySelector('#canvasAvatar'), 
                ctx = canvas.getContext('2d'),
                img = document.querySelector('#avatar img'),
                min = Math.min(img.width, img.height);

            canvas.width = min
            canvas.height = min

            if( img.width > img.height)
                ctx.drawImage(img, (img.width - img.height / img.width * img.width) / 2, 0, img.height, img.height, 0, 0, min, min)
 
            else
                ctx.drawImage(img, 0, (img.height - img.width / img.height * img.height) / 2, img.width, img.width, 0, 0, min, min)

            let stream = canvas.captureStream(25)

            resolve( stream )
        })
    }

    buildPromises(){

        let promises = []

        // Pomises result in 0, 1, 2, 3 promises
        if( ! this.settings.headset || this.settings.pInP ){
            if(this.settings.pInP && ! this.settings.headset ){
                promises.push( this.startRecordingWebCamMic( this.settings.pInP, this.settings.headset) )
                if( this.settings.pInP && this.settings.useAvatarInPInP )
                    promises.push( this.startStreamFromAvatarCanvas() )
            }
            else if( this.settings.pInP && this.settings.useAvatarInPInP ){
                if( ! this.settings.headset )
                    promises.push( this.startRecordingWebCamMic( false, this.settings.headset) )
                promises.push( this.startStreamFromAvatarCanvas() )
            }
            else if( this.settings.headset){
                promises.push( this.startRecordingWebCamMic( true, this.settings.headset) )
            }
            else if( ! this.settings.headset )
                promises.push( this.startRecordingWebCamMic( false, this.settings.headset) )
            if( this.settings.pInP && this.settings.drawNameAtBottomPInP && ! this.settings.usePiPAPI && this.settings.personName ){
                promises.push( this.startStreamFromNameCanvas() )
            }
        }

        return promises
    }

    getAudioStreamFromStreams( streams ){
        
        if(this.testWebCam) return null

        if( this.settings.headset)
            return streams[ 0 ]
        else if( streams.length > 1)
            return streams[ 1 ]
        else 
            return null
    }

    getVideoStreamFromStreams( streams, audio ){
        
        if( streams.length == 1)
            return streams[ 0 ] // Testcam or screen

        else if( ! this.settings.headset && streams.length == 2){
            if(this.settings.pInP){
                // Merge 1 and 2 (screen, webcam or avatar)
                if( this.settings.usePiPAPI)
                    return streams[ 0 ]
                return this.mergeVideoStreams( audio, streams[ 1 ], streams[ 0 ])
            }
            else
                return streams[ 0 ]
        }
        else if( streams.length == 2){
            // Merge 1 and 2 (screen and webcam or avatar)
            if( this.settings.pInP && this.settings.usePiPAPI)
                return streams[ 0 ]
            return this.mergeVideoStreams( audio, streams[ 1 ], streams[ 0 ])
        }
        else if( ! this.settings.headset && streams.length == 3){
            if( this.settings.pInP && this.settings.usePiPAPI)
                return streams[ 0 ]
            // Merge 1 and 3 (webcam and avatar or name)
            if( this.settings.pInP && this.settings.useAvatarInPInP )
                return this.mergeVideoStreams( audio, streams[ 2 ], streams[ 0 ])
            if( this.settings.pInP && this.settings.drawNameAtBottomPInP && this.settings.personName )
                return this.mergeVideoStreams( audio,  streams[ 1  ], streams[ 0 ], streams[ 2 ])
            else
                return this.mergeVideoStreams( audio,  streams[ 1  ], streams[ 0 ])
        }
        else if( streams.length == 3){
            if( this.settings.pInP && this.settings.usePiPAPI)
                return streams[ 0 ]
            // Merge 1, 2 and 3 (screen, webcam or avatar and name)
            if( this.settings.pInP && this.settings.useAvatarInPInP )
                return this.mergeVideoStreams( audio, streams[ 0], streams[ 2 ])
            return this.mergeVideoStreams( audio, streams[ 0 ], streams[ 1 ], streams[ 2 ])
        }
        else if( ! this.settings.headset && streams.length == 4){
            // Merge 1, 3 and 4 (screen, webcam or avatar and name)
            return this.mergeVideoStreams( audio, streams[ 2 ], streams[ 0 ], streams[ 3 ])
        }
    }

    mergeVideoStreams( audio, screen, stream2, name ){

        if( stream2 ){
            if( ! this.merger )
                this.merger = new VideoStreamMerger( { width: window.screen.width, height: window.screen.height} )

            if( audio.getAudioTracks().length == 0 ){
                this.errorMsg = 'Cannot merge picture in picture because no audio stream is available.'
                return screen
            }

            if( screen.getAudioTracks().length == 0){
                screen = this.addAudioTrack(screen, audio)
            }

            if( stream2.getAudioTracks().length == 0){
                stream2 = this.addAudioTrack( stream2, audio)
            }

            if( name && name.getAudioTracks().length == 0){
                name = this.addAudioTrack( name, audio)
            }

            this.mergeStreams( screen, stream2, name )
            return this.merger._canvas.captureStream()
        }
        else{
            return screen;
        }
    }

    addAudioTrack(stream, audio){
        let context = new AudioContext(),
        dest = context.createMediaStreamDestination();

        context.createMediaStreamSource( audio ).connect( dest )

        return new MediaStream( [ stream.getVideoTracks()[0], dest.stream.getAudioTracks()[0]] )
    }

    playBack( stream ){
        this.html.canvas.srcObject = stream

        if( this.settings.pInP && this.settings.usePiPAPI ){
            this.html.canvas.muted = true
        }
        this.html.canvas.play()
    }

    startMediaRecorder( stream ){
        let options = {mimeType: 'video/webm'};
        this.recordedBlobs = [];
        
        if( typeof MediaRecorder != 'undefined'){
            this.mediaRecorder = new MediaRecorder( stream, options);
            this.mediaRecorder.ondataavailable = ( event ) => { this.handleDataAvailable(event) };
            this.mediaRecorder.onstop = ( event ) => { this.handleStop(event) };
    
            this.mediaRecorder.start( this.settings.samplesMillis ); 
    
            this.html.btnPause.disabled = false
            this.html.btnDownload.disabled = true
        }
    }


    handleDataAvailable( event ){

        if (event.data && event.data.size > 0) {
            this.recordedBlobs.push(event.data);
        }
    }

    handleStop(event){

        const superBuffer = new Blob(this.recordedBlobs, {type: 'video/webm'});
        this.html.canvas.src = window.URL.createObjectURL(superBuffer);
        this.html.canvas.play()

        this.html.btnPause.disabled = true
        this.html.btnStart.blur()
    }

    download(){

        const blob = new Blob(this.recordedBlobs, {type: 'video/webm'});
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'screencast.webm';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 100);
    }

    startTestRecording(){
        return new Promise( (resolve, reject) => {
            this.validSettings()
            .catch( (e) => {
                this.errorMsg = e
                return reject( e )
            })
            .then( ( status ) => {

                if( status == 'ok' ){
                    let promise = null
                    if( this.settings.useAvatarInPInP )
                        promise = this.startStreamFromAvatarCanvas()
                    else
                        promise = this.startTestRecordingWebCam()
    
                    Promise.resolve( promise )
                    .catch( ( e ) => {
                        return reject( e )
                    })
                    .then( ( stream ) => {
                        this.streamsIn.push( stream )
                        this.streamOut = this.getVideoStreamFromStreams( [ stream ] )
                        this.playBack( this.streamOut )
                        resolve( 'ok' )
                    })
                }
            })
        })
    }

    startRecording(){
        return new Promise( (resolve, reject) => {

            this.validSettings()
            .catch( (e) => {
                this.errorMsg = e
                return reject( e )
            })
            .then( ( status ) => {

                if( status == 'ok' ){
                    this.startRecordingScreen()
                    .catch( ( e ) => {
                        this.errorMsg = e
                        return reject( e )
                    })
                    .then( ( stream0 ) => {

                        if( ! stream0 ) {
                            return reject( )
                        }
                        
                        let promises = this.buildPromises(),
                        streamsIn = [];
        
                        if( promises.length == 0)
                            promises.push( new Promise( (resolve) => {
                                resolve(null)
                            })
                        )
                    
                        streamsIn.push( stream0 )
                        this.streamsIn = streamsIn
        
                        Promise.all( promises )
                        .catch( ( e ) => {
                            this.errorMsg = e
                            reject( e )
                        })
                        .then( ( streams ) => { 
        
                            if( typeof streams == 'undefined') return reject()
        
                            if( streams[ 0 ])
                                streamsIn = [...streamsIn, ...streams]
                                    
                            this.streamsIn = streamsIn
        
                            let audio = this.getAudioStreamFromStreams( this.streamsIn ),
                                video = this.getVideoStreamFromStreams( this.streamsIn, audio );
        
                            if( typeof audio != 'undefined' 
                                && audio.getAudioTracks().length > 0
                                && video.getVideoTracks().length > 0)
                                this.streamOut = new MediaStream([ video.getVideoTracks()[0], audio.getAudioTracks()[0]])
                            else
                                this.streamOut = this.streamsIn[ 0 ]
    
                            if(this.settings.pInP && this.settings.usePiPAPI){
                                let str = 1
                                if( ! this.settings.headset && this.settings.useAvatarInPInP )
                                    str = 2
                                this.playBack( this.streamsIn[ str ] )
                            }
    
                            if( ! this.testWebCam){
                                this.startMediaRecorder( this.streamOut )
                            }
                        })
                        .catch( (e) => {
                            this.errorMsg = e
                            return reject()
                        })
                        .then( () => {
                            return resolve('ok')
                        })
                    })
                    .catch( (e) => {
                        this.stopRecording()
                        this.errorMsg = e
                        reject( e )
                    })
                }
            })

        })
    }

    stopRecording(){

        if( this.streamsIn){
            this.streamsIn.forEach( (streamIn) => {
                if( streamIn ){
                    let a = [...streamIn.getVideoTracks(), ...streamIn.getAudioTracks()]
                    a.forEach( (track) => {
                        if(track)
                            track.stop();
                    });
                }
            })  
        }
        
        //this.html.canvas.pause()
        
        if( this.settings.usePiPAPI ){
            this.html.canvas.muted = false
            this.html.canvas.pause()
            this.html.canvas.srcObject = null
        }
    }

    pauseRecording(){
        this.html.btnPause.blur()

        if( this.mediaRecorder ){
            if( this.mediaRecorder.state == 'recording'){
                this.mediaRecorder.pause()
            }
            else if(this.mediaRecorder.state == 'paused'){
                this.mediaRecorder.resume()
            }
        }
    }

    toggleTestVideoIn(){
        return new Promise( ( resolve, reject ) => {
            if( this.videoIn === false){
                this.startTestRecording()
                .catch( ( e ) => {
                    this.errorMsg = e
                    return reject( e)
                })
                .then( ( status ) => {
                    if( status == 'ok'){
                        this.videoIn = true
                        this.testWebCam = true
                        this.setButtonsTest( true )
                        this.html.btnTestMic.disabled = true
                        this.html.btnDownload.disabled = true
                        resolve()
                    }
                })
            }
            else{
                this.stopRecording()
                this.videoIn = false
                this.setButtonsTest( false )
                this.html.btnTestMic.disabled = false
                this.testWebCam = false
                this.html.canvas.srcObject = null
                this.html.btnTestWebCam.blur()
                resolve()
            }
        })
    }

    toggleVideoIn(){

        if( this.videoIn === false){

            this.html.btnStart.blur()

            this.startRecording()
            .catch( ( e ) => {
                this.errorMsg = e
                return
            })
            .then( ( status ) => {
                if( status == 'ok'){
                    this.videoIn = true
                    this.html.btnStart.classList.add('recording')
                    this.setButtonsrecording( true )

                    this.html.btnDownload.disabled = true
                }
            })
        }
        else{

            this.stopRecording()

            this.setButtonsrecording( false)

            this.html.btnStart.classList.remove('recording')

            if( this.mediaRecorder && !this.testWebCam){
                this.mediaRecorder.stop();
                this.html.btnDownload.disabled = false
            }

            this.videoIn = false
        }
    }
}