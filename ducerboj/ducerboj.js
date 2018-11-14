// ducerboj.js - an app to help train your brain to do SO2R
// (Single Operator 2 Radio) contesting.
//

MAX_STATIONS = 1 

$( document ).ready(function() {
  console.log("READY");
  // Insert other on-load app initialization here
  document.lastRadioLogged = -1;
});

function mkStation(outputNode) {
  // Select a callsign at random
  var callsign = document.callsigns[Math.floor(Math.random()*document.callsigns.length)];
  // Create a station with that callsign in search and pounce mode
  var station = new Station(callsign, "sp")
  console.log(context);
  console.log(outputNode);
  station.init(context, outputNode);
  station.keyer.setPitch(Math.random() * 500 + 200);
  station.keyer.setSpeed(Math.random() * 25 + 10);
  station.setRfGain(Math.random);
  return station;
}

function replaceStation(index, active, historical, audioSink) {
  if (index == -1) {
    return;
  }
  active[index].stop();
  var station = mkStation(audioSink);
  active[index] = station;
  station.sendRepeated(station.getCallsign(), 2000);
  historical.push(station);
}

function alreadyScored(callSign) {
  for (si = 0; si < document.scoredStations.length; si++) {
    if (document.scoredStations[si].getCallsign() == callSign) {
      console.log(callSign + " was already scored");
      return true;
    }
  }
  return false;
}

function checkCallsign(callSign, radio) {
  active = (radio == 0) ? document.leftStations : document.rightStations;
  historical = (radio == 0) ? document.leftStationsHistorical : document.rightStationsHistorical;
  var audioSink = (radio == 0) ? leftGain : rightGain;
  var correct = false;
  for (si = 0; si < active.length; si++) {
    if (active[si].getCallsign() == callSign) {
      correct = true;
      console.log("Correct: " + callSign);
      if (document.lastRadioLogged != -1 && radio != document.lastRadioLogged) {
        document.score += 5;
      } else {
        document.score++;
      }
      document.correct += 1;
      document.lastRadioLogged = radio;
      document.scoredStations.push(active[si]);
      break;
    }
  }
  if (!correct) {
    // Check history
    for (si = 0; si < historical.length; si++) {
      if (historical[si].getCallsign() == callSign && !alreadyScored(callSign)) {
        correct = true;
        si = -1;  // Magic value to indicate copy from history
        console.log("Correct: " + callSign);
        document.correct += 1;
        if (document.lastRadioLogged != -1 && radio != document.lastRadioLogged) {
          document.score += 5;
        } else {
          document.score++;
        }
        document.lastRadioLogged = radio;
        break;
      }
    }
    document.incorrect += 1;
  }
  // If the call was correct, then make a new one. If it was wrong,
  // but we're only doing one station in each ear, then create a
  // new one.
  if (correct) {
    replaceStation(si, active, historical, audioSink);
  }
  return correct;
}

function animateScore(oldScore, newScore) {
  console.log("animate: " + oldScore + " " + newScore);
  if (newScore - oldScore > 4) {
    console.log("bonus");
    $("#score").removeClass("wrong");
    $("#score").removeClass("correct");
    $("#score").addClass("bonus");
  } else if (newScore - oldScore > 0) {
    console.log("correct");
    $("#score").removeClass("wrong");
    $("#score").addClass("correct");
    $("#score").removeClass("bonus");
  } else {
    console.log("wrong");
    $("#score").addClass("wrong");
    $("#score").removeClass("correct");
    $("#score").removeClass("bonus");
  }
}

$(function() {
  $("#start").click(function() {
    console.log("Start");

    // Initialize score
    $("#score").val(0);

    // Wipe log fields
    $('#log_left').html("");
    $('#log_right').html("");
    // Start focused on left input
    $("#callsign_left").focus();

    // Initialize audio chain
    context = new (window.AudioContext || window.webkitAudioContext);

    var so2rcontroller = new SO2RController();
    // Any way to make these not global?
    leftGain = context.createGain();
    rightGain = context.createGain();

    leftGain.gain.value = 1.0;
    rightGain.gain.value = 1.0;

    so2rcontroller.init(context, context.destination);

    leftGain.connect(so2rcontroller.getRadio1Input());
    rightGain.connect(so2rcontroller.getRadio2Input());

    document.leftStations = []
    document.leftStationsHistorical = []
    document.leftGain = leftGain;
    document.rightStations = []
    document.rightStationsHistorical = []
    document.rightGain = rightGain;
    document.scoredStations = []
    document.score = 0;
    document.correct = 0;
    document.incorrect = 0;
    document.start_time = new Date();
    $("#elapsed_time").val("0:00");
    $("#rate").val("");
    $("#correct").val("");
    $("#incorrect").val("");
    for (i = 0; i < MAX_STATIONS; i++) {
      ls = mkStation(leftGain);
      document.leftStations.push(ls);
      document.leftStationsHistorical.push(ls);
      rs = mkStation(rightGain);
      document.rightStations.push(rs);
      document.rightStationsHistorical.push(rs);
    }

    so2rcontroller.selectBothRadios();

    // TODO(ggood) instead of keeping separate arrays for left and right
    // stations, keep one array of tuples (stn, audioSink). That will
    // clean up all of the timeout handlers
    for (i = 0; i < MAX_STATIONS; i++) {
      document.leftStations[i].sendRepeated(document.leftStations[i].getCallsign(), 2000);
      document.rightStations[i].sendRepeated(document.rightStations[i].getCallsign(), 2000);
    }

    // Start reaper for lonely stations who have given up sending their callSign
    // Runs every 1/2 second. reaperId is intentionally global.
    reaperId = setInterval(function(){
      console.log("Checking for lonelies");
      for (i = 0; i < MAX_STATIONS; i++) {
        var station = document.leftStations[i];
        if (station.msgCounter < 1) {
          console.log("Station " + station.getCallsign() + " is lonely, spawining new station");
          replaceStation(i, document.leftStations, document.leftStationsHistorical, leftGain);
        }
        station = document.rightStations[i];
        if (station.msgCounter < 1) {
          console.log("Station " + station.getCallsign() + " is lonely, spawning new station");
          replaceStation(i, document.rightStations, document.rightStationsHistorical, rightGain);
        }
      }
    }, 500);

    timeUpdateId = setInterval(function(){
      et = Math.round((new Date() - document.start_time) / 1000);
      document.elapsed_time = et;
      minutes = Math.floor(et / 60);
      seconds = Math.floor(et % 60);
      if (seconds < 10) {
          seconds = "0" + seconds;
      }
    }, 1000);

  });



  $("#end").click(function() {
    console.log("Stop");
    for (i = 0; i < MAX_STATIONS; i++) {
      document.leftStations[i].stop();
      document.leftStations[i].keyer.stop();
      document.rightStations[i].stop();
      document.rightStations[i].keyer.stop();
      clearTimeout(reaperId);
      clearTimeout(timeUpdateId);
    }
  });

  $("#help").click(function() {
    console.log("Help");
    window.open("ducerboj-help.html", "helpWindow", "height=700,width=640,top=10,left=10");
  });

  // Intercept keystrokes we handle specially
  $(document).keydown(function(e) {
    if (typeof e.which == 'undefined') {
      return;
    }
    if (e.which == 9) {
      e.preventDefault();
      if ($("#callsign_left").is(":focus")) {
        console.log("Focus Right");
        $("#callsign_right").focus();
      } else {
        console.log("Focus Left");
        $("#callsign_left").focus();
      }
    }
  });

  $('#callsign_left').on('keypress', function (e) {
    if (e.keyCode == 13) {
      // Put callsign in log
      var callsign = $("#callsign_left").val().toUpperCase();
      $("#callsign_left").val("");
      var oldScore = document.score;
      var correct = checkCallsign(callsign, 0);
      // Update score, correct, incorrect
      $("#score").val(document.score);
      $("#correct").val(document.correct);
      $("#incorrect").val(document.incorrect);
      $("#elapsed_time").val(minutes + ":" + seconds);
      rateFactor = 3600 / document.elapsed_time;
      rate = Math.round(rateFactor * document.score);
      $("#rate").val(rate);
      var icon = correct ? "<br>&#9989;" : "<br>&#10060;";
      $('#log_left').append(icon + callsign );
      // Keep scrolled to bottom
      $('#log_left').scrollTop($('#log_left')[0].scrollHeight - $('#log_left')[0].clientHeight);
      // animate score
      animateScore(oldScore, document.score);
    }
  });

  $('#callsign_right').on('keypress', function (e) {
    if (e.keyCode == 13) {
      // Put callsign in log
      var callsign = $("#callsign_right").val().toUpperCase();
      $("#callsign_right").val("");
      var oldScore = document.score;
      var correct = checkCallsign(callsign, 1);
      // Update score
      $("#score").val(document.score);
      $("#correct").val(document.correct);
      $("#incorrect").val(document.incorrect);
      rateFactor = 3600 / document.elapsed_time;
      rate = Math.round(rateFactor * document.score);
      $("#rate").val(rate);
      var icon = correct ? "<br>&#9989;" : "<br>&#10060;";
      $('#log_right').append(icon + callsign );
      // Keep scrolled to bottom
      $('#log_right').scrollTop($('#log_right')[0].scrollHeight - $('#log_right')[0].clientHeight);
      // animate score
      animateScore(oldScore, document.score);
    }
  });

  $("#reset_left").click(function() {
    console.log("Reset left");
    for (i = 0; i < MAX_STATIONS; i++) {
      document.leftStations[i].cancelRepeated();
      document.leftStations[i].stop();
      var newStation = mkStation(leftGain);
      document.leftStations[i] = newStation;
      document.leftStationsHistorical.push(newStation);
      setTimeout(function() {newStation.sendRepeated(newStation.getCallsign(), 2000)}, 2000);
    }
  });

  $("#reset_right").click(function() {
    console.log("Reset right");
    for (i = 0; i < MAX_STATIONS; i++) {
      document.rightStations[i].cancelRepeated();
      document.rightStations[i].stop();
      var newStation = mkStation(rightGain);
      document.rightStations[i] = newStation;
      document.rightStationsHistorical.push(newStation);
      setTimeout(function() {newStation.sendRepeated(newStation.getCallsign(), 2000)}, 2000);
    }
  });

});
