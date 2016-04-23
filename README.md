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

## Authors

* Rob Holt (INSERT STUDENT ID HERE)
* Benjamin Kaiser (INSERT STUDENT ID HERE)
* Bruno Marques (INSERT STUDENT ID HERE)
* Ned Pummeroy (586530)
