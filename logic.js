/*
		Drum Kit Designer Mapper.pst
		
		This PST allows you to change the notes that trigger the various Drum Kit
		Designer voices. 

		You can also set which controller changes the articulationID for the HiHat
		Opening and if that controller should be inverted.
		
		For convenience, there is a flag "SHOW_INCOMING_NOTE" that you can set to 
		true so that you can see the note that your controller pad/key triggers. 
		This is set to false by default. 
*/
ResetParameterDefaults = true;			//Global Scripter variable, for reseting 
//PluginParameter values to their default
//value when re-running the script
var SHOW_INCOMING_NOTE = false;     //set this to true, to print the incoming
//note to the console

var INVERT_HIHAT_MOD = true;				//if HiHat controller should be inverted
var HIHAT_CONTROLLER = 1;						//current controller number
var CURRENT_HIHAT_ARTICULATION = 1;	//current articulation ID for Closed Hi-Hat
var NOTES = MIDI._noteNames;				//array of MIDI note names for menu items

const DEFAULT_MAPPINGS = {
	kick: 36,
	snareEdge: 34,
	snareCenter: 38,
	rimshot: 40,
	rimshotEdge: 32,
	sideStick: 37,
	stick: 75,
	clap: 39,
	lowTom: 41,
	lowMidTom: 45,
	highMidTom: 47,
	highTom: 48,
	hhClosedTip: 42,
	hhShank: 44,
	hhOpenEdge: 46,
	hhFootClose: 33,
	hhFootSplash: 31,
	rideOut: 51,
	rideIn: 59,
	rideEdge: 52,
	rideBell: 53,
	crashLeft: 49,
	crashRight: 57,
	crashLeftStop: 28,
	crashRightStop: 29,
	tambourine: 54,
	shaker: 70,
}


// -------------------- PAD ALIASES (Maschine 4x4) --------------------
// Incoming pad note → logical voice trigger note
// These notes should match the values used in CUSTOM_MAPPINGS

var PAD_ALIASES = {
	// Row 1
	24: DEFAULT_MAPPINGS.kick,          // C0  -> Kick
	25: DEFAULT_MAPPINGS.snareCenter,   // C#0 -> Snare Center
	26: DEFAULT_MAPPINGS.hhShank,       // D0  -> HH Shank
	27: DEFAULT_MAPPINGS.hhClosedTip,   // D#0 -> HH Closed Tip

	// Row 2
	28: DEFAULT_MAPPINGS.kick,          // E0  -> Kick
	29: DEFAULT_MAPPINGS.rimshot,       // F0  -> Rimshot
	30: DEFAULT_MAPPINGS.sideStick,     // F#0 -> Side Stick
	31: DEFAULT_MAPPINGS.hhOpenEdge,    // G0  -> HH Open Edge

	// Row 3
	32: DEFAULT_MAPPINGS.highTom,       // G#0 -> High Tom
	33: DEFAULT_MAPPINGS.highMidTom,    // A0  -> High-Mid Tom
	34: DEFAULT_MAPPINGS.lowMidTom,     // A#0 -> Low-Mid Tom
	35: DEFAULT_MAPPINGS.lowTom,        // B0  -> Low Tom

	// Row 4
	36: DEFAULT_MAPPINGS.crashLeft,     // C1  -> Crash Left
	37: DEFAULT_MAPPINGS.crashRight,    // C#1 -> Crash Right
	38: DEFAULT_MAPPINGS.rideIn,        // D1  -> Ride In
	39: DEFAULT_MAPPINGS.rideBell       // D#1 -> Ride Bell
};


var CUSTOM_MAPPINGS = {};


var MIN_VELOCITY = 28;   // DKD needs higher minimum to trigger ghost notes
var CURVE = 2.4;        // Stronger curve for light hits

function scaleVelocity(v) {
	// Normalize
	var norm = v / 127;

	// Apply strong curve for light hits
	var curved = Math.pow(norm, 1 / CURVE);

	// Rescale to MIDI range
	var scaled = Math.round(curved * 127);

	// Enforce minimum so DKD always triggers
	if (scaled < MIN_VELOCITY) scaled = MIN_VELOCITY;

	return Math.min(127, scaled);
}

//------------------------------ HandleMIDI () ---------------------------------
function HandleMIDI(event) {
	if (event instanceof NoteOn) {
		if (SHOW_INCOMING_NOTE) {
			Trace(MIDI.noteName(event.pitch));
		}

		var incomingPitch = event.pitch;

		// 1. Translate the incoming pad to the DKD voice
		if (PAD_ALIASES[incomingPitch] !== undefined) {
			event.pitch = PAD_ALIASES[incomingPitch];

			// 2. ARTICULATION RULES

			// RULE A: If it's Pad 26 or 27 (the closed pads), FORCE them to stay closed (ID 1)
			// This prevents the Smart Strip from making your closed hats sound open.
			if (incomingPitch === 26 || incomingPitch === 27) {
				event.articulationID = (INVERT_HIHAT_MOD) ? 7 : 1;
			}

			// RULE B: If it's Pad 31 (Open Edge), use the Strip position (CURRENT_HIHAT_ARTICULATION)
			else if (incomingPitch === 31) {
				event.articulationID = CURRENT_HIHAT_ARTICULATION;
			}

			event.velocity = scaleVelocity(event.velocity);

			// 3. Send the note and a custom NoteOff
			event.send();
			var noteOff = new NoteOff(event);
			noteOff.sendAfterMilliseconds(100);
			return;
		}
	}
	else if (event instanceof ControlChange) {
		if (event.number === HIHAT_CONTROLLER) {
			updateHiHat(event.value);
		} else {
			event.send();
		}
	} else {
		event.send();
	}
}
//-------------------------- ParameterChanged () -------------------------------
function ParameterChanged(param, value) {
	switch (param) {
		case 0:
			CUSTOM_MAPPINGS["kick"] = value;
			break;
		case 1:
			CUSTOM_MAPPINGS["snareEdge"] = value;
			break;
		case 2:
			CUSTOM_MAPPINGS["snareCenter"] = value;
			break;
		case 3:
			CUSTOM_MAPPINGS["rimshot"] = value;
			break;
		case 4:
			CUSTOM_MAPPINGS["rimshotEdge"] = value;
			break;
		case 5:
			CUSTOM_MAPPINGS["sideStick"] = value;
			break;
		case 6:
			CUSTOM_MAPPINGS["stick"] = value;
			break;
		case 7:
			CUSTOM_MAPPINGS["clap"] = value;
			break;
		case 8:
			CUSTOM_MAPPINGS["lowTom"] = value;
			break;
		case 9:
			CUSTOM_MAPPINGS["lowMidTom"] = value;
			break;
		case 10:
			CUSTOM_MAPPINGS["highMidTom"] = value;
			break;
		case 11:
			CUSTOM_MAPPINGS["highTom"] = value;
			break;
		case 12:
			CUSTOM_MAPPINGS["hhClosedTip"] = value;
			break;
		case 13:
			CUSTOM_MAPPINGS["hhShank"] = value;
			break;
		case 14:
			CUSTOM_MAPPINGS["hhOpenEdge"] = value;
			break;
		case 15:
			CUSTOM_MAPPINGS["hhFootClose"] = value;
			break;
		case 16:
			CUSTOM_MAPPINGS["hhFootSplash"] = value;
			break;
		case 17:
			CUSTOM_MAPPINGS["rideOut"] = value;
			break;
		case 18:
			CUSTOM_MAPPINGS["rideIn"] = value;
			break;
		case 19:
			CUSTOM_MAPPINGS["rideEdge"] = value;
			break;
		case 20:
			CUSTOM_MAPPINGS["rideBell"] = value;
			break;
		case 21:
			CUSTOM_MAPPINGS["crashLeft"] = value;
			break;
		case 22:
			CUSTOM_MAPPINGS["crashRight"] = value;
			break;
		case 23:
			CUSTOM_MAPPINGS["crashLeftStop"] = value;
			break;
		case 24:
			CUSTOM_MAPPINGS["crashRightStop"] = value;
			break;
		case 25:
			CUSTOM_MAPPINGS["tambourine"] = value;
			break;
		case 26:
			CUSTOM_MAPPINGS["shaker"] = value;
			break;
		//invert hi hat opening
		case 27:
			if (value === 0) {
				INVERT_HIHAT_MOD = false;
			} else {
				INVERT_HIHAT_MOD = true;
			}
			break;
		//set controller number for changing HiHat artID
		case 28:
			//subtract 1, to make up for the offset of adding "-- Off --" to the menu options
			HIHAT_CONTROLLER = value - 1;
			//if "Hi-Hat Opening Via" is set to Off, default to closed articulation
			if (HIHAT_CONTROLLER < 0) {
				updateHiHat(1)
			}
			break;
		default:
			Trace("ParameterChanged(): error: unknown parameter index.");
	}
}

//----------------------------- updateHiHat () ---------------------------------
/**
	This function updates the articulation ID for HiHat, based on the controller 
	value. If Invert Hi-Hat Opening is true, use the inverted value.

	@param value is the incoming MIDI CC value
*/
function updateHiHat(value) {
	if (value > 114) {
		CURRENT_HIHAT_ARTICULATION = (INVERT_HIHAT_MOD) ? 1 : 7;
	} else if (value > 94) {
		CURRENT_HIHAT_ARTICULATION = (INVERT_HIHAT_MOD) ? 2 : 6;
	} else if (value > 74) {
		CURRENT_HIHAT_ARTICULATION = (INVERT_HIHAT_MOD) ? 3 : 5;
	} else if (value > 54) {
		CURRENT_HIHAT_ARTICULATION = 4;
	} else if (value > 34) {
		CURRENT_HIHAT_ARTICULATION = (INVERT_HIHAT_MOD) ? 5 : 3;
	} else if (value > 14) {
		CURRENT_HIHAT_ARTICULATION = (INVERT_HIHAT_MOD) ? 6 : 2;
	} else {
		CURRENT_HIHAT_ARTICULATION = (INVERT_HIHAT_MOD) ? 7 : 1;
	};
}

//create numbered MIDI CC names, with added "-- Off --" option
var MIDI_CC_NAMES = ["-- Off --"];
for (var i = 0; i < MIDI._ccNames.length; i++) {
	MIDI_CC_NAMES.push(i + " - " + MIDI._ccNames[i]);
}



//create UI --------------------------------------------------------------------
var PluginParameters = [{
	name: "Kick",
	type: "menu",
	valueStrings: NOTES,
	numberOfSteps: 127,
	defaultValue: DEFAULT_MAPPINGS.kick,
}, {
	name: "Snare Edge",
	type: "menu",
	valueStrings: NOTES,
	numberOfSteps: 127,
	defaultValue: DEFAULT_MAPPINGS.snareEdge,
}, {
	name: "Snare Center",
	type: "menu",
	valueStrings: NOTES,
	numberOfSteps: 127,
	defaultValue: DEFAULT_MAPPINGS.snareCenter,
}, {
	name: "Rimshot",
	type: "menu",
	valueStrings: NOTES,
	numberOfSteps: 127,
	defaultValue: DEFAULT_MAPPINGS.rimshot,
}, {
	name: "Rimshot Edge",
	type: "menu",
	valueStrings: NOTES,
	numberOfSteps: 127,
	defaultValue: DEFAULT_MAPPINGS.rimshotEdge,
}, {
	name: "Side Stick",
	type: "menu",
	valueStrings: NOTES,
	numberOfSteps: 127,
	defaultValue: DEFAULT_MAPPINGS.sideStick,
}, {
	name: "Stick",
	type: "menu",
	valueStrings: NOTES,
	numberOfSteps: 127,
	defaultValue: DEFAULT_MAPPINGS.stick,
}, {
	name: "Clap",
	type: "menu",
	valueStrings: NOTES,
	numberOfSteps: 127,
	defaultValue: DEFAULT_MAPPINGS.clap,
}, {
	name: "Low Tom",
	type: "menu",
	valueStrings: NOTES,
	numberOfSteps: 127,
	defaultValue: DEFAULT_MAPPINGS.lowTom,
}, {
	name: "Low-Mid Tom",
	type: "menu",
	valueStrings: NOTES,
	numberOfSteps: 127,
	defaultValue: DEFAULT_MAPPINGS.lowMidTom,
}, {
	name: "High-Mid Tom",
	type: "menu",
	valueStrings: NOTES,
	numberOfSteps: 127,
	defaultValue: DEFAULT_MAPPINGS.highMidTom,
}, {
	name: "High Tom",
	type: "menu",
	valueStrings: NOTES,
	numberOfSteps: 127,
	defaultValue: DEFAULT_MAPPINGS.highTom,
}, {
	name: "Hi-Hat Closed Tip",
	type: "menu",
	valueStrings: NOTES,
	numberOfSteps: 127,
	defaultValue: DEFAULT_MAPPINGS.hhClosedTip,
}, {
	name: "Hi-Hat Shank",
	type: "menu",
	valueStrings: NOTES,
	numberOfSteps: 127,
	defaultValue: DEFAULT_MAPPINGS.hhShank,
}, {
	name: "Hi-Hat Open Edge",
	type: "menu",
	valueStrings: NOTES,
	numberOfSteps: 127,
	defaultValue: DEFAULT_MAPPINGS.hhOpenEdge,
}, {
	name: "Hi-Hat Foot Close",
	type: "menu",
	valueStrings: NOTES,
	numberOfSteps: 127,
	defaultValue: DEFAULT_MAPPINGS.hhFootClose,
}, {
	name: "Hi-Hat Foot Splash",
	type: "menu",
	valueStrings: NOTES,
	numberOfSteps: 127,
	defaultValue: DEFAULT_MAPPINGS.hhFootSplash,
}, {
	name: "Ride Out",
	type: "menu",
	valueStrings: NOTES,
	numberOfSteps: 127,
	defaultValue: DEFAULT_MAPPINGS.rideOut,
}, {
	name: "Ride In",
	type: "menu",
	valueStrings: NOTES,
	numberOfSteps: 127,
	defaultValue: DEFAULT_MAPPINGS.rideIn,
}, {
	name: "Ride Edge",
	type: "menu",
	valueStrings: NOTES,
	numberOfSteps: 127,
	defaultValue: DEFAULT_MAPPINGS.rideEdge,
}, {
	name: "Ride Bell",
	type: "menu",
	valueStrings: NOTES,
	numberOfSteps: 127,
	defaultValue: DEFAULT_MAPPINGS.rideBell,
}, {
	name: "Crash Left",
	type: "menu",
	valueStrings: NOTES,
	numberOfSteps: 127,
	defaultValue: DEFAULT_MAPPINGS.crashLeft,
}, {
	name: "Crash Right",
	type: "menu",
	valueStrings: NOTES,
	numberOfSteps: 127,
	defaultValue: DEFAULT_MAPPINGS.crashRight,
}, {
	name: "Crash Left Stop",
	type: "menu",
	valueStrings: NOTES,
	numberOfSteps: 127,
	defaultValue: DEFAULT_MAPPINGS.crashLeftStop,
}, {
	name: "Crash Right Stop",
	type: "menu",
	valueStrings: NOTES,
	numberOfSteps: 127,
	defaultValue: DEFAULT_MAPPINGS.crashRightStop,
}, {
	name: "Tambourine",
	type: "menu",
	valueStrings: NOTES,
	numberOfSteps: 127,
	defaultValue: DEFAULT_MAPPINGS.tambourine,
}, {
	name: "Shaker",
	type: "menu",
	valueStrings: NOTES,
	numberOfSteps: 127,
	defaultValue: DEFAULT_MAPPINGS.shaker,
}, {
	name: "Invert Hi-Hat Opening",
	type: "checkbox",
	defaultValue: 0,

}, {
	name: "Hi-Hat Opening Via",
	type: "menu",
	valueStrings: MIDI_CC_NAMES,
	defaultValue: 2,
	numberOfSteps: MIDI_CC_NAMES.length - 1
}];