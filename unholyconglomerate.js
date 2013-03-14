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
		this.redraw();

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
		this.player = this._createActor(Player);
		var monster = this._createActor(LimbedCreature);
		monster.addLimb(new Limb({hp:20}));
		monster = this._createActor(LimbedCreature);
		monster.addLimb(new Limb({hp:20}));
		monster = this._createActor(LimbedCreature);
		monster.addLimb(new Limb({hp:20}));
	},

	_getEmptyTiles: function(){
		var emptyTiles =[];
		var tile = null;
		for(var x in this.map){
			for(var y in this.map[x]){
				tile = this.map[x][y];
				if(tile.walkable && !tile.unit && tile.items.length == 0){
					emptyTiles.push(x+','+y);
				}
			}
		}
		return emptyTiles;
	},

	_createActor: function(actor, x, y) {
		if(!x || !y){
			var emptyTiles = this._getEmptyTiles();
			if(!emptyTiles)
				return false;
			var index = Math.floor(ROT.RNG.getUniform() * emptyTiles.length);
			var parts = emptyTiles[index].split(',');
			x = parseInt(parts[0]);
			y = parseInt(parts[1]);
		}

		//If tile doesnt exist return false
		if(!(x in Game.map))
			return false;
		if(!(y in Game.map[x]))
			return false;

		var tile = Game.map[x][y];

		//If tile isn't walkable return false
		if(!tile.walkable)
			return false;

		//If tile has a creature in it do something else
		if(tile.unit != null)
			return false;

		//Place actor at the specified location
		var actor = new actor(x,y);

		//Add actor to map tile
		this.map[x][y].unit = actor;

		//Add the player to the engine
		this.engine.addActor(actor);

		return actor;
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
	this.items = [];
	this.unit = null;

	//Apply customs params
	for(var param in params){
		this[param] = params[param];
	}
};
FloorTile.prototype = new Tile();
FloorTile.prototype.draw = function(x,y,brightness){
	if(this.unit){
		this.unit.draw(brightness);
	}else if(this.items.length > 0){
		this.items[0].draw(x,y,brightness);
	}else{
		Tile.prototype.draw.call(this,x,y,brightness);
	}
}

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
	this._description = 'actor'; //Default name of actor
	this._color = [255,100,100]; //Red is scary right?
	this._queue = []; //Queue of actions to do before recomputing
};
//Draw this actor on the map
Actor.prototype.draw = function(brightness){
	if(!brightness)
		brightness = 0;
	Game.display.draw(this._x, this._y,this._character, 
		ROT.Color.toHex(ROT.Color.interpolate(this._color,[0,0,0],brightness)));
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
//Get the current tile from the map
Actor.prototype.getTile = function(){
	return Game.map[this._x][this._y];
};
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

	var tile = Game.map[newX][newY];

	//If tile isn't walkable return false
	if(!tile.walkable)
		return false;

	//If tile has a creature in it do something else
	if(tile.unit != null){
		if(this.doAttack){
			this.doAttack(tile.unit);
			return true;
		}else{
			return false;
		}
	}

	//Remove self from previous tile and add self to new tile
	tile.unit = this;
	this.getTile().unit = null;

	//Do the move!
	this._x = newX;
	this._y = newY;

	//Redraw the map with the moved agent
	Game.redraw();

	return true;
};


//Child of actor for actors with limbs
var LimbedCreature = function(x,y){
	//Call parent constructor
	Actor.call(this,x,y);

	//Defaults
	this._maxLimbs = 4; // Maximum number of limbs allowed
	this._limbs = []; // Array of attached limbs
	this._description = "abomination";
	
	//Base torso stats
	this._attack = 0;
	this._defense = 40;
	this._damage = 3;
	this._hp = 20;
	this._hpBase = 20;
};
LimbedCreature.prototype = new Actor();
//Add a new limb to the creature. Gross
LimbedCreature.prototype.addLimb = function(newLimb){
	//If has a place to attach limb
	if(this._limbs.length < this._maxLimbs){
		//Add the limb to the list of limbs
		this._limbs.push(newLimb);
		//Add the stats of the limb
		this._attack += newLimb.attack;
		this._defense += newLimb.defense;
		this._speed += newLimb.speed;
		this._damage += newLimb.damage;

		return newLimb;
	}
	return false; // FAILED!
};
//Remove a limb from the creature. Really gross
LimbedCreature.prototype.removeLimb = function(limbIndex){
	//Make sure limbIndex is valid
	if(!(limbIndex in this._limbs))
		return false;

	var limb = this._limbs[limbIndex];
	
	//Remove limb stat modifiers
	this._attack -= limb.attack;
	this._defense -= limb.defense;
	this._damage -= limb.damage;
	this.speed -= limb.speed;

	//Drop limb on the ground
	limb.hp = limb.hpBase;
	this.getTile().items.push(limb);

	//Remove limb from list
	this._limbs.splice(limbIndex,1);
};
LimbedCreature.prototype.attackRoll = function(){
	// 1d100 + base attack stat
	return this._attack + ROT.RNG.getPercentage();
};
LimbedCreature.prototype.damageRoll = function(){
	return ROT.RNG.getNormal(this._damage, this._damage/4);
};
LimbedCreature.prototype.getDefense = function(){
	// static defense stat
	return this._defense;
};
LimbedCreature.prototype.doAttack = function(defender){
	console.log('the',this._description,'attacks the',defender._description);
	if(this.attackRoll() < defender.getDefense()){
		console.log('the',this._description,'missed');
		return false; // Attack misses
	}else{
		console.log('the',this._description,'hit!')
		defender.applyDamage(this.damageRoll());
	}
};
//Apply damage to creature
LimbedCreature.prototype.applyDamage = function(damage){
	if(this._limbs.length > 0){
		//Choose a limb to damage randomly
		var limbIndex = Math.floor(ROT.RNG.getUniform() * this._limbs.length);
		var limb = this._limbs[limbIndex];

		if(limb.hp > damage){
			//Limb takes damage but isn't destroyed
			limb.hp -= damage;
			console.log('the',this._description+"'s",limb.description,"is hurt!");
		}else{
			//Limb is destroyed by attack
			//Get remaining damage
			damage -= limb.hp;
			console.log('the',this._description+"'s",limb.description,"is lopped off!");
			//Remove limb
			this.removeLimb(limbIndex);
			//Rollover remaining damage
			this.applyDamage(damage);
		}
	}else{
		//No limbs! Damage the torso
		console.log('the',this._description, "is hit in it's vulnerable core");
		this._hp -= damage;
		if(this._hp <= 0){
			//Creature dies
			console.log('the',this._description, "has died");

			//TODO: drop limbs / items
			//How are limbs dropped if limbs are destroyed first?

			this.getTile().unit = null;
			Game.engine.removeActor(this);
			Game.redraw();
		}
	}
};


//THE PLAYER
var Player = function(x,y) {
	//Inherit from Limbed Creature
	LimbedCreature.call(this,x,y);

	//Setup Display
	this._character = '@';
	this._color = [100,255,100];
	this._description = "hero";

	//Add Human Legs
	this.addLimb(new Limb({speed:50,hp:10, description: "human leg"}));
	this.addLimb(new Limb({speed:50,hp:10, description: "human leg"}));

	//Add Human Arms
	this.addLimb(new Limb({attack:10,damage:5, description: "human arm"})); //Left Arm
	this.addLimb(new Limb({attack:20,damage:10,defense:20, description: "human sword arm"})); //Sword Arm
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
Player.prototype.move = function(x,y){
	if(!Actor.prototype.move.call(this, x,y))
		return false;

	var tile = this.getTile();
	//Check if there are items on the tile
	if(tile.items.length > 0){
		for(var i = 0; i < tile.items.length;i++){
			console.log('there is a',tile.items[i].description,'here.');
		}
	}
	return true;
}
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

// Item root class
var Item = function(){
	this._character = '*';
	this._color = [255,255,100];
	this.description = "amorphous object";
}
Item.prototype.draw = function(x,y,brightness){
	Game.display.draw(x, y,this._character, 
		ROT.Color.toHex(ROT.Color.interpolate(this._color,[0,0,0],brightness)));
};

// Limb class
var Limb = function(params){
	this.attack = 0;
	this.defense = 0;
	this.damage = 0;
	this.speed = 0;
	this.hp = 5;
	this._character = '/';
	this.description = "non-descript appendage";
	//Apply custom params
	for(var param in params){
		this[param] = params[param];
	}
	this.hpBase = this.hp;
};
Limb.prototype = new Item();
