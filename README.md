# comp90020-uno

A web based implementation of the game Uno, for the project in
COMP90020 Distributed Algorithms during semester 1, 2016, at
The University of Melbourne.

## Technologies

### WebRTC

WebRTC is used as an underlying network layer.
What this gives us is a way to automatically maintain a strongly
connected network between all connected processes with primitives
for multicasting.

## Instructions

To start a server in the current directory, run:

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
* Benjamin Kaiser (INSERT STUDENT ID HERE)
* Bruno Marques (INSERT STUDENT ID HERE)
* Ned Pummeroy (586530)
