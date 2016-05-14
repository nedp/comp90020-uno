var GameView = React.createClass({
  // initial state of the view
  getInitialState: function () {
    return {message: 'Game initialising', myHand: []};
  },
  // render function for the view
  render: function () {
    var players = [];
    var cntPlayers = 0;
    if (this.state.players) {
      this.state.players.forEach(function (value) {
        // what is their card count
        var cardCount = null;
        if (this.state.cardCounts) {
          cardCount = this.state.cardCounts[value];
        }
        // whether or not to show if they said uno (they are safe)
        var showSafe = false;
        if (cardCount && cardCount === 1 &&
            (this.state.unoSet && !this.state.unoSet[value]) ||
            (this.state.unoSafe && this.state.unoSafe[value])) {
          showSafe = true;
        }
        // have we readied up
        var isReady = this.state.ready && this.state.ready[value];
        players.push(<PlayerView key={value}
                                 takingTurn={this.state.turnOwner === value}
                                 playerId={value}
                                 winner={value === this.state.winner}
                                 cardCount={cardCount}
                                 showSafe={showSafe}
                                 isReady={isReady}
                                 idx={++cntPlayers}></PlayerView>);
      }.bind(this));
    }

    var ReadyUpButton = null;
    if (!this.state.isInitialised &&
        this.state.players &&
        this.state.players.length > 0) {
      ReadyUpButton = <div onClick={Application.readyUp}
                           className="btn btn-default">
                        Ready!
                      </div>;
    } else if (!this.state.isInitialised) {
      ReadyUpButton = <div>Finding peers... Share the URL!</div>;
    }

    var DrawButton = null;
    var UnoButton = null;
    if (this.state.isInitialised &&
        this.state.isMyTurn &&
        !this.state.requestSpecial) {
      DrawButton = <div onClick={Application.pickupCard}
                           className="btn btn-primary turnButton">
                        Pick up card
                      </div>;
    }

    // only draw the uno button if we have 1 card right now
    if (this.state.myHand.length === 1 &&
        this.state.timeTakenToUno === null) {
      UnoButton = <div onClick={Application.onUnoButton}
        className="btn btn-success unoButton">
        Uno
      </div>;
    }

    var cancelSuiteSelection = null;
    var myHandCards = [];
    var idx = 0;
    if (this.state.requestSpecial) {
      // the suite selection of the wild card I am playing
      var card = CardFetcher.fromString(this.state.requestSpecial.type);
      Object.keys(CardFetcher.SUIT).forEach(function (suite) {
        var specificCard = CardFetcher.create(card.type, CardFetcher.SUIT[suite]);
        myHandCards.push(<CardView key={idx++ + specificCard.toString()}
                                   card={specificCard}></CardView>);
      });
      // special button for cancelling the suite selection
      cancelSuiteSelection = <div onClick={Application.cancelSuitSelection}
                                  className='btn btn-default'>
                               Cancel Selection
                             </div>;
    } else {
      // the cards in my hand
      this.state.myHand.forEach(function (card) {
        myHandCards.push(<CardView key={idx++ + card.toString()} card={card}></CardView>);
      });
    }

    // show the top card if it's there
    var topCard = null;
    if (this.state.topCard) {
      topCard = <CardView card={this.state.topCard}></CardView>;
    }

    return <div>
             <h4>Players</h4>
             <table><tbody>
               {players}
             </tbody></table>
             { ReadyUpButton }
             <h4>Top Card</h4>
             <div className='topCard'>
               {topCard}
               { DrawButton }
               { UnoButton }
             </div>
             <h4>Current Hand</h4>
             <div className={'myHand' +
                             (this.state.requestSpecial ? ' specialPicker' : '') +
                             (this.state.isMyTurn ? '  isMyTurn' : ' isNotMyTurn')}>
               { myHandCards }
               { cancelSuiteSelection }
             </div>
           </div>;
  },
});

var CardView = React.createClass({
  render: function () {
    return <img src={'cards/' + this.props.card.toString() + '.svg'}
                onClick={Application.playCard.bind(undefined, this.props.card)}
                className='card'>
          </img>;
  },
});

var PlayerView = React.createClass({
  render: function () {
    var turnClass = this.props.takingTurn ? 'takingTurn' : 'notTakingTurn';

    var cardCountLabel = null;
    var readyLabel = null;
    var gotchaLabel = null;
    var safeLabel = null;
    if (this.props.cardCount !== null && this.props.cardCount >= 0) {
      cardCountLabel = <span className="label label-primary cardCount">
                         {this.props.cardCount}
                       </span>;
      // don't show gotcha labels when someone has won
      if (!this.props.winner) {
        gotchaLabel = <span className="btn btn-sm btn-primary"
                            onClick={Application.onGotchaButton.bind(null, this.props.playerId)}>
                        Gotcha!
                      </span>;
      }
      // show the safe label so we know they have said uno
      if (this.props.showSafe) {
        safeLabel = <span className="label label-success">SAFE</span>;
      }
    } else if (this.props.isReady) {
      readyLabel = <span className="label label-primary">
                  READY
                </span>;
    }

    var winnerLabel = null;
    if (this.props.winner) {
      winnerLabel = <span className="label label-success">
                      WINNER!
                    </span>;
    }

    var meLabel = null;
    if (this.props.playerId === Network.myId) {
      meLabel = <span className="label label-info">
                  ME
                </span>;
    }

    return <tr className={'player ' + turnClass}>
               <td>{meLabel}</td>
               <td>Player {this.props.idx}</td>
               <td>{readyLabel}{cardCountLabel}{safeLabel}</td>
               <td>({this.props.playerId})</td>
               <td>{ gotchaLabel }{winnerLabel}</td>
             </tr>;
  },
});

var RootComponent = ReactDOM.render(<GameView />, document.getElementById('reactDiv'));
