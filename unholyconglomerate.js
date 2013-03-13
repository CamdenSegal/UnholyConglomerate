// UNHOLY CONGLOMERATE
// A 7DRL made by Camden Segal
// @camdensegal
// camden@camdensegal.com

//The main game object!
var Game = {
	display: null,
	map: {},
	player: null,

	init: function() {
		//Setup display
		this.display = new ROT.Display();
		document.body.appendChild(this.display.getContainer());

		//Remove loading text
		var loadingText = document.getElementById("loading");
		loadingText.parentNode.removeChild(loadingText);

		//Setup game engine
		this.engine = new ROT.Engine();

		//Generate and draw the map
		this._generateMap();
		this._drawVisibleMap(40,12,14);

		//Start the game!
		this.engine.start();
	},

	//Used to populate the map with tiles
	_generateMap: function() {
		var digger = new ROT.Map.Digger();

		var digCallback = function(x,y,value){
			//If row not created yet
			if(!this.map[x]){
				this.map[x] = {};
			}

			if(value) {
				//Place a wall tile
				this.map[x][y] = new WallTile();
			}else{
				//Place a floor tile
				this.map[x][y] = new FloorTile();
			}
		};

		//Run the digger
		digger.create(digCallback.bind(this));

		//Create the player
		this._createPlayer();
	},

	_createPlayer: function() {
		//Place player at the middle of the map
		this.player = new Player(40,12);

		//Add the player to the engine
		this.engine.addActor(this.player);
	},

	_drawVisibleMap: function(x,y,r){
		//Clear the display maybe some stuff is no longer visible
		this.display.clear();

		//Initialize a fov object
		var fov = new ROT.FOV.PreciseShadowcasting(this._lightPasses.bind(this));

		var fovCallback = function(x,y,d,visibility){
			//Draw the tile with brightness based on distance from player
			this.map[x][y].draw(x,y,(d/r));
		};

		//Run the FOV Calculations
		fov.compute(x,y,r,fovCallback.bind(this));

		//Draw the player after the map
		this.player.draw();
	},

	//Return if light passes through the specified tile
	_lightPasses : function(x,y){
		if(!(x in this.map))
			return false;
		return (y in this.map[x]) ? this.map[x][y].lightPasses : false;
	},

	//Redraw the display.
	redraw: function(){
		this._drawVisibleMap(this.player._x,this.player._y,14);
	}
};

//Tile classes
var Tile = function(params){
	//Default attributes
	this.character = '*'; //Display
	this.fg = [255,255,255]; //Foreground Color
	this.bg = [0,0,0]; //Background color
	this.description = "a point in space"; //Description (not used yet)
	this.lightPasses = true; //Does light pass through this block?
	this.walkable = true; //Can actors stand here?
	
	//Apply custom params
	for(var param in params){
		this[param] = params[param];
	}
};
//Draw this tile at specified position with specified brightness
Tile.prototype.draw = function(x, y, brightness){
	Game.display.draw(x,y,this.character,
		ROT.Color.toHex(ROT.Color.interpolate(this.fg,[0,0,0],brightness)),
		ROT.Color.toHex(ROT.Color.interpolate(this.bg,[0,0,0],brightness)));
};

//Floor tile class
var FloorTile = function(params){
	//Call tile contstructer
	Tile.call(this, params);

	//Defaults
	this.character = '.';
	this.fg = ROT.Color.randomize([220,240,220],[5,30,5]); // slight color variation
	this.description = "open floor";

	//Apply customs params
	for(var param in params){
		this[param] = params[param];
	}
};
FloorTile.prototype = new Tile();

var WallTile = function(params){
	//Call tile contstructer
	Tile.call(this, params);

	//Defaults
	this.character = ' ';
	this.fg = [0,0,0];
	this.bg = ROT.Color.randomize([250,250,250],[5,5,5]);
	this.description = "rock wall";
	this.lightPasses = false;
	this.walkable = false;

	//Apply custom params
	for(var param in params){
		this[param] = params[param];
	}
};
WallTile.prototype = new Tile();

//Actor class
var Actor = function(x,y){
	//Place actor
	this._x = x;
	this._y = y;

	//Defauts
	this._speed = 100; //Determines turn order
	this._character = 'M'; //Default diplay M for Meany Monster
	this._color = [255,100,100]; //Red is scary right?
	this._queue = []; //Queue of actions to do before recomputing
};
//Draw this actor on the map
Actor.prototype.draw = function(){
	Game.display.draw(this._x, this._y,this._character, ROT.Color.toHex(this._color));
};
//Execute a turn
Actor.prototype.act = function(){
	if(this._queue.length > 0){
		//Get the next task from the queue
		var task = this._queue.shift();

		//Do the task
		switch(task){
			case 'wait': //Wait for one turn
				return true;
			default: //Wait if no task recognized
				return true;
		}
	}
	//No action done yet!
	return false;
};
//Get the speed of the actor
Actor.prototype.getSpeed = function(){ return this._speed; };
//Attempt to move actor in desired direction
Actor.prototype.move = function(x,y){
	//Get new position
	var newX = this._x + x;
	var newY = this._y + y;

	//If tile doesnt exist return false
	if(!(newX in Game.map))
		return false;
	if(!(newY in Game.map[newX]))
		return false;

	//If tile isn't walkable return false
	if(!Game.map[newX][newY].walkable)
		return false;

	//Do the move!
	this._x = newX;
	this._y = newY;

	//Redraw the map with the moved agent
	Game.redraw();

	return true;
};

var LimbedCreature = function(x,y){
	//Call parent constructor
	Actor.call(this,x,y);

	//Defaults
	this._maxLimbs = 4; // Maximum number of limbs allowed
	this._limbs = []; // Array of attached limbs
};
LimbedCreature.prototype = new Actor();
//Add a new limb to the creature. Gross
LimbedCreature.prototype.addLimb = function(newLimb){
	if(this._limbs.length < this._maxLimbs){
		this._limbs.push(newLimb);
		return newLimb;
	}
	return false; // FAILED!
};




//THE PLAYER
var Player = function(x,y) {
	//Inherit from Limbed Creature
	LimbedCreature.call(this,x,y);

	//Setup Display
	this._character = '@';
	this._color = [100,255,100];

	//Add Human Legs
	this.addLimb(new Limb({speed:50,hp:10}));
	this.addLimb(new Limb({speed:50,hp:10}));

	//Add Human Arms
	this.addLimb(new Limb({attack:10,holder:true}));
	this.addLimb(new Limb({attack:10,holder:true}));
};
Player.prototype = new LimbedCreature();
//Player turn logic
Player.prototype.act = function(){
	//Check if actor has preassigned move
	if(Actor.prototype.act.call(this))
		return true;

	//Lock the engine and wait for keyboard input
	Game.engine.lock();
	window.addEventListener("keydown",this);
};
//Handle keyboard input
Player.prototype.handleEvent = function(e){
	switch(e.keyCode){
		//MOVEMENT KEYS
		case ROT.VK_NUMPAD8:
		case ROT.VK_UP:
		case ROT.VK_K:
			if(!this.move(0,-1))
				return false; // Move failed
			break; // Move succeded
		case ROT.VK_NUMPAD2:
		case ROT.VK_DOWN:
		case ROT.VK_J:
			if(!this.move(0,1))
				return false;
			break;
		case ROT.VK_NUMPAD4:
		case ROT.VK_LEFT:
		case ROT.VK_H:
			if(!this.move(-1,0))
				return false;
			break;
		case ROT.VK_NUMPAD6:
		case ROT.VK_RIGHT:
		case ROT.VK_L:
			if(!this.move(1,0))
				return false;
			break;
		case ROT.VK_NUMPAD7:
		case ROT.VK_Y:
			if(!this.move(-1,-1))
				return false;
			break;
		case ROT.VK_NUMPAD9:
		case ROT.VK_U:
			if(!this.move(1,-1))
				return false;
			break;
		case ROT.VK_NUMPAD1:
		case ROT.VK_B:
			if(!this.move(-1,1))
				return false;
			break;
		case ROT.VK_NUMPAD3:
		case ROT.VK_N:
			if(!this.move(1,1))
				return false;
			break;
		default:
			return false; // No action mapped to event.
	}

	//Stop listening till next turn
	window.removeEventListener("keydown",this);

	//Resume engine
	Game.engine.unlock();
	return true;
};

// Limb class
var Limb = function(modifiers){
	this.modifiers = modifiers ? modifiers : {};
};
