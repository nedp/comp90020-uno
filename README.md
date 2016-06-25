# comp90020-uno

A web based implementation of the game Uno, for the project in
COMP90020 Distributed Algorithms during semester 1, 2016, at
The University of Melbourne.

## Playing via Github pages

To access play the version of the game on the gh-pages branch, 
go to http://nedp.github.io/comp90020-uno/?room=ROOM_NAME

Players who use the same room parameter will be placed in a game
together.

## Architecture

Each browser tab is treated as an independent process, and these
process communicate with each other directly to maintain a game
of Uno.

### Failure handling

The implementation assumes a synchronous network. 
That means it assumes that network round trip times fall within 
hardcoded bounds.
This assumption is required for reliable failure detection.

We also did not implement a "reliable" multicast algorithm,
meaning that if a broadcasting process fails in the middle of a
multicast, the system may be left in an inconsistent state.
So we assume that no process will fail during its broadcasting 
step.

We claim that, subject to the stated assumptions, the system will
recover from any combination of process crashes and process 
additions so long as at least one original process survives.

###  WebRTC

WebRTC is used as an underlying network layer.
What this gives us is a way to automatically maintain a strongly
connected network between all connected browsers without any
server side code of our own; we depend on public TURN/STUN servers.

## Hosting locally

Although we only have a static page, a web server is required
for serving it.
To start your own server in the current directory you can run:

```
python -m http.server 8080
```

Then visit http://localhost:8080/ in your browser on several different
tabs.
The tabs will start being an interface for playing Uno; one player can
play via each tab.

To create a custom room, visit http://localhost:8080/?room=myroom where `myroom`
is whatever room you would like to name your room, then when sharing the url
other players will join your room.

### Notes on JSX files

You'll want to run `npm run build` to monitor JSX files for changes so that
corresponding JS files are updated.

## Authors

* Rob Holt (388648)
* Benjamin Kaiser (655060)
* Bruno Marques (659338)
* Ned Pummeroy (586530)
