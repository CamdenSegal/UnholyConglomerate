// UNHOLY CONGLOMERATE
// A 7DRL made by Camden Segal
// @camdensegal
// camden@camdensegal.com

//The main game object!
var Game = {
	display: null,
	map: {},
	levelSeeds: [],
	player: null,
	messages: [],
	displayHeight: 30,
	displayWidth: 80,
	curLevel: 0,

	init: function() {
		//Setup display
		this.display = new ROT.Display({width: this.displayWidth, height: this.displayHeight});
		document.getElementById('gameHere').appendChild(this.display.getContainer());

		//Remove loading text
		var loadingText = document.getElementById("loading");
		loadingText.parentNode.removeChild(loadingText);

		//Setup game engine
		this.engine = new ROT.Engine();

		//Generate and draw the map
		this.levelSeeds.push(ROT.RNG.getState());
		this._generateMap();
		this.redraw();

		//Start the game!
		this.engine.start();
	},

	//Used to populate the map with tiles
	_generateMap: function() {
		this.map = {};
		this.engine.clear();
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
		if(!this.player){
			this.player = this._createActor(Player);
		}else{
			this._placeActor(this.player);
		}

		if(this.curLevel != 0){
			//Add up stairs at player
			this.map[this.player.getX()][this.player.getY()].structure = new Structure("up stairs", "^", [100,100,255], function(){
				Game.prevLevel();
			});
		}

		var emptyTiles = Game._getEmptyTiles();
		var index = Math.floor(ROT.RNG.getUniform() * emptyTiles.length);
		var parts = emptyTiles[index].split(',');
		x = parseInt(parts[0],10);
		y = parseInt(parts[1],10);
		this.map[x][y].structure = new Structure("down stairs","v",[100,100,255], function(){
			Game.nextLevel();
		});

		var numMonsters = Math.floor(ROT.RNG.getNormal(8,4));
		if(numMonsters < 4)
			numMonsters = 4;
		for(var i = 0; i < numMonsters; i++){
			this._generateMonster();
		}
	},

	_loadLevel: function(levelNum){
		ROT.RNG.setState(this.levelSeeds[levelNum]);
		this._generateMap();
		this.curLevel = levelNum;
		this.redraw();
	},

	prevLevel: function(){
		this._loadLevel(this.curLevel - 1);
	},

	nextLevel: function() {
		this.levelSeeds.push(ROT.RNG.getState());
		this.curLevel++;
		this._generateMap();
		this.redraw();
	},

	_getEmptyTiles: function(){
		var emptyTiles =[];
		var tile = null;
		for(var x in this.map){
			for(var y in this.map[x]){
				tile = this.map[x][y];
				if(tile.walkable && !tile.unit && tile.items.length === 0 && !tile.structure){
					emptyTiles.push(x+','+y);
				}
			}
		}
		return emptyTiles;
	},

	_createActor: function(actorClass, x, y, options) {
		//Place actor at the specified location
		var actor = new actorClass(x,y,options);

		return this._placeActor(actor,x,y);
	},

	_placeActor: function(actor, x,y){
		if(!x || !y){
			var emptyTiles = this._getEmptyTiles();
			if(!emptyTiles)
				return false;
			var index = Math.floor(ROT.RNG.getUniform() * emptyTiles.length);
			var parts = emptyTiles[index].split(',');
			x = parseInt(parts[0],10);
			y = parseInt(parts[1],10);
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
		if(tile.unit !== null)
			return false;

		actor.setPos(x,y);

		//Add actor to map tile
		this.map[x][y].unit = actor;

		//Add the player to the engine
		this.engine.addActor(actor);

		return actor;
	},

	_generateMonster: function(level, corruption){
		level = Math.floor(ROT.RNG.getNormal((level ? level : this.curLevel),1));
		if(level < 0)
			level = 0; 

		corruption = corruption ? corruption : (this.curLevel * 5) + 10;

		var leveledMonsters = [];
		for(var monster in Monsters){
			if(Monsters[monster].level == level)
				leveledMonsters.push(Monsters[monster]);
		}

		if(leveledMonsters.length > 0){
			var monsterStats = leveledMonsters[Math.floor(ROT.RNG.getUniform() * leveledMonsters.length)];
		}else{
			var monsterStats = Monsters[Math.floor(ROT.RNG.getUniform() * Monsters.length)];
		}
		
		//Pull out limb stats and dont pass to constructor
		var limbs = monsterStats.limbs;
		monsterStats.limbs = [];
		
		//Create the monster
		var monster = new LimbedCreature(0,0,monsterStats);

		for(var i = 0; i < limbs.length; i++){
			var limb = limbs[i];
			if(ROT.RNG.getPercentage() < corruption){
				var limbKeys = Object.keys(Limbs);
				limb = Limbs[limbKeys[Math.floor(ROT.RNG.getUniform() * limbKeys.length)]];//random mutated limb
				console.log(limb);
			}
			if(limb instanceof Array)
				limb = limb[Math.floor(ROT.RNG.getUniform() * limb.length)];
			monster.addLimb(new Limb(limb));
		}

		this._placeActor(monster);
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

	playerVisible: function(x,y,r){
		//Initialize a fov object
		var fov = new ROT.FOV.PreciseShadowcasting(this._lightPasses.bind(this));

		var seen = false;
		
		var fovCallback = function(x,y,d,visibility){
			//Draw the tile with brightness based on distance from player
			if(this.map[x][y].unit == this.player){
				seen = [x,y];
			}
		};

		//Run the FOV Calculations
		fov.compute(x,y,r,fovCallback.bind(this));
		
		return seen;
	},

	//Redraw the display.
	redraw: function(){
		this._drawVisibleMap(this.player.getX(),this.player.getY(),14);
		this._drawMessages();
	},

	//Do graphic prompt
	prompt: function(options, curChoice, callback, title){
		this.display.clear();
		for(var i = 0; i < options.length; i++){
			this.display.drawText(5,i+1,""+options[i]);
		}
		if(title)
			this.display.drawText(3,0,title);
		this.display.draw(3,curChoice+1,'>');
		var promptHandler = function(e){
			switch(e.keyCode){
				case ROT.VK_NUMPAD8:
				case ROT.VK_UP:
				case ROT.VK_K:
					if(curChoice-1 >= 0){
						window.removeEventListener('keydown',promptHandler);
						Game.prompt(options,curChoice-1,callback,title);
					}
					return;
				case ROT.VK_NUMPAD2:
				case ROT.VK_DOWN:
				case ROT.VK_J:
					if(curChoice+1 < options.length){
						window.removeEventListener('keydown',promptHandler);
						Game.prompt(options,curChoice+1,callback,title);
					}
					return;
				case ROT.VK_RETURN:
					window.removeEventListener('keydown',promptHandler);
					callback(curChoice);
					return;
				default:
					return;
			}
		};
		window.addEventListener('keydown',promptHandler);
	},

	//Show a message on the screen
	addMessage: function(message){
		this.messages.push( message );
		console.log(message);
		if(this.messages.length > this.displayHeight/3)
			this.messages.shift();
		this.redraw();
		if(message.length > this.displayWidth)
			this.addMessage('');
	},

	//Clear all messages
	clearMessages: function(){
		this.messages = [];
		this.redraw();
	},

	_drawMessages: function(){
		var msgY = 0;
		if(this.player.getY() < this.displayHeight/2)
			msgY = this.displayHeight - this.messages.length;
		for(var i = 0; i < this.messages.length; i++){
			this.display.drawText(0,msgY,this.messages[i]);
			msgY+=1;
		}
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
	this.structure = null;

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
	}else if(this.structure){
		this.structure.draw(x,y,brightness);
	}else{
		Tile.prototype.draw.call(this,x,y,brightness);
	}
};

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
//Position Getters and Setter
Actor.prototype.getX = function(){ return this._x;}
Actor.prototype.getY = function(){ return this._y;}
Actor.prototype.setPos = function(x,y){
	this._x = x; 
	this._y = y;
}
//Attempt to move actor in desired direction
Actor.prototype.move = function(x,y,noAttack){
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
	if(tile.unit !== null){
		if(this.doAttack && !noAttack){
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

//List of common states
var States = {
	//Drunken walk
	randomWalk: function(actor){
		var direction = ROT.DIRS[4][Math.floor(ROT.RNG.getUniform()*4)];
		actor.move(direction[0],direction[1],true);
	},

	//A* Route to last seen location
	chase: function(actor, seen){
		var x = seen[0];
		var y = seen[1];
		var path = [];

		var passableCallback = function(x,y) {
			return Game.map[x][y].walkable;
		};

		var pathCallback = function(x,y) {
			path.push([x,y]);
		};

		var astar = new ROT.Path.AStar(x,y, passableCallback, {topology:8});
		astar.compute(actor.getX(), actor.getY(), pathCallback);

		path.shift();

		if(path.length == 0)
			return States.randomWalk(actor);

		x = path[0][0] - actor.getX();
		y = path[0][1] - actor.getY();

		//If next to player attack it!
		if(path.length == 1){
			actor.move(x,y);
		}else{ //Otherwise avoid attacking other monsters
			actor.move(x,y,true);
		}
	}
};

//Brain class, used for determining actor behavior
var Brain = function(idleState, activeState, sense){
	// Actions to do while idle
	this._idleState = idleState;

	// Actions to do while active (player in sight)
	this._activeState = activeState;

	// Determines if active
	this._sense = sense;
};
Brain.prototype.act = function(actor){
	var seen = this._sense.look(actor.getX(), actor.getY());
	if(seen){
		console.log(actor._description,"active",seen);
		this._activeState(actor,seen);
	}else{
		console.log(actor._description,"inactive",seen);
		this._idleState(actor);
	}
};

var Sense = function(){
	//Last seen at location.
	this.seen = [0,0];

	//How long ago was seen.
	this.lastSeen = 100;

	//How long of memory
	this.maxLastSeen = 10;
};
Sense.prototype.look = function(x,y){
	//If last seen was beyond memory return false
	if(this.lastSeen >= this.maxLastSeen)
		return false;

	//Increment memory
	this.lastSeen++;

	//Return last seen location
	return this.seen;
};

var Sight = function(distance){
	//Inherit from Sense
	Sense.call(this);

	//Max view range
	this.viewRange = distance;
};
Sight.prototype = new Sense();
Sight.prototype.look = function(x,y){
	//Look for the player
	var tSeen = Game.playerVisible(x,y,this.viewRange)

	//If the player is seen remember where and when
	if(tSeen){
		this.seen = tSeen;
		this.lastSeen = 0;
	}

	//Alert the senses!
	return Sense.prototype.look.call(this,x,y);
};

//Child of actor for actors with limbs
var LimbedCreature = function(x,y,params){
	//Call parent constructor
	Actor.call(this,x,y);

	//Defaults
	this._maxLimbs = 4; // Maximum number of limbs allowed
	this._limbs = []; // Array of attached limbs
	this._description = "abomination";
	this._species = "none";

	//Base torso stats
	this._attack = 0;
	this._defense = 40;
	this._damage = 3;
	this._hp = 20;
	

	//AI!
	this._brain = new Brain(States.randomWalk, States.chase, new Sight(10));

	//Apply customs params
	for(var param in params){
		this['_'+param] = params[param];
	}

	this._hpBase = this._hp;
	this._character = this._description[0];
};
LimbedCreature.prototype = new Actor();
//Act!
LimbedCreature.prototype.act = function(){
	//Check if actor has preassigned move
	if(Actor.prototype.act.call(this))
		return true;

	if(this._brain)
		return this._brain.act(this);

	//No action done yet!
	return false;
};
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

	if(!this._noDrop){
		//Drop limb on the ground
		limb.hp = limb.hpBase;
		this.getTile().items.push(limb);
	}

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
	Game.addMessage('the '+this._description+' attacks the '+defender._description);
	if(this.attackRoll() < defender.getDefense()){
		Game.addMessage('the '+this._description+' missed');
		return false; // Attack misses
	}else{
		Game.addMessage('the '+this._description+' hit!');
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
			Game.addMessage('the '+this._description+"'s "+limb.description+" is hurt!");
		}else{
			//Limb is destroyed by attack
			//Get remaining damage
			damage -= limb.hp;
			Game.addMessage('the '+this._description+"'s "+limb.description+" is lopped off!");
			//Remove limb
			this.removeLimb(limbIndex);
			//Rollover remaining damage
			this.applyDamage(damage);
		}
	}else{
		//No limbs! Damage the torso
		Game.addMessage('the '+this._description+ " is hit in it's vulnerable core");
		this._hp -= damage;
		if(this._hp <= 0){
			//Creature dies
			this._kill();
		}
	}
};
//Kill the creature drop it's items
LimbedCreature.prototype._kill = function(){
	Game.addMessage('the '+this._description+ " has died");

	//TODO: drop items
	this.getTile().items.push(new StaticItem(this._description+" corpse"));

	this.getTile().unit = null;
	Game.engine.removeActor(this);
	Game.redraw();
}
//Return a human readable description including descriptions of all limbs.
LimbedCreature.prototype.describe = function(){
	var result = "A "+this._description+". It has "+this._limbs.length+" limbs. ";
	for(var i = 0; i < this._limbs.length; i++){
		if(this._limbs[i].species == this._species){
			result += "It has a "+this._limbs[i].description+". ";
		}else{
			result += "It has a "+this._limbs[i].describe()+". ";
		}
	}
	return result;
};


//THE PLAYER
var Player = function(x,y) {
	//Inherit from Limbed Creature
	LimbedCreature.call(this,x,y);

	//Disable AI
	this._brain = null;

	//Doesn't Drop Limbs
	this._noDrop = true;

	//Setup Display6
	this._character = '@';
	this._color = [100,255,100];
	this._description = "hero";
	this._species = 'human';

	//Add Human Legs
	this.addLimb(new Limb(Limbs.humanLeg));
	this.addLimb(new Limb(Limbs.humanLeg));

	//Add Human Arms
	this.addLimb(new Limb(Limbs.humanArm)); //Left Arm
	this.addLimb(new Limb(Limbs.humanSwordArm)); //Sword Arm
};
Player.prototype = new LimbedCreature();
//Player turn logic
Player.prototype.act = function(){
	//Check if actor has preassigned move
	if(LimbedCreature.prototype.act.call(this))
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
			Game.addMessage('there is a '+tile.items[i].describe()+' here.');
		}
	}
	return true;
};
//Handle keyboard input
Player.prototype.handleEvent = function(e){
	switch(e.keyCode){
		//MOVEMENT KEYS
		case ROT.VK_NUMPAD8:
		case ROT.VK_UP:
		case ROT.VK_K:
			Game.clearMessages();
			if(!this.move(0,-1))
				return false; // Move failed
			break; // Move succeded
		case ROT.VK_NUMPAD2:
		case ROT.VK_DOWN:
		case ROT.VK_J:
			Game.clearMessages();
			if(!this.move(0,1))
				return false;
			break;
		case ROT.VK_NUMPAD4:
		case ROT.VK_LEFT:
		case ROT.VK_H:
			Game.clearMessages();
			if(!this.move(-1,0))
				return false;
			break;
		case ROT.VK_NUMPAD6:
		case ROT.VK_RIGHT:
		case ROT.VK_L:
			Game.clearMessages();
			if(!this.move(1,0))
				return false;
			break;
		case ROT.VK_NUMPAD7:
		case ROT.VK_Y:
			Game.clearMessages();
			if(!this.move(-1,-1))
				return false;
			break;
		case ROT.VK_NUMPAD9:
		case ROT.VK_U:
			Game.clearMessages();
			if(!this.move(1,-1))
				return false;
			break;
		case ROT.VK_NUMPAD1:
		case ROT.VK_B:
			Game.clearMessages();
			if(!this.move(-1,1))
				return false;
			break;
		case ROT.VK_NUMPAD3:
		case ROT.VK_N:
			Game.clearMessages();
			if(!this.move(1,1))
				return false;
			break;
		//Other controls
		case ROT.VK_NUMPAD5:
		case ROT.VK_P:
			Game.clearMessages();
			//pickup item
			this.pickup();
			return;
		case ROT.VK_PERIOD:
		case 110:
			Game.clearMessages();
			if(e.shiftKey){
				if(this.getTile().structure){
					if(this.getTile().structure.character = "v")
						Game.nextLevel();
				}
			}
			//Wait 1 turn
			break;
		case ROT.VK_SLASH:
		case 111:
			Game.clearMessages();
			//Look around
			Game.addMessage(this.describe());
			break;
		case ROT.VK_D:
			//Dismember self!
			this.applyDamage(this.damageRoll());
			return true;
		default:
			return false; // No action mapped to event.
	}
	this.endTurn();
	return true;
};
Player.prototype.endTurn = function(){
	//Stop listening till next turn
	window.removeEventListener("keydown",this);
	//Resume engine
	Game.engine.unlock();
};
//Pickup item from current tile
Player.prototype.pickup = function(){
	var items = this.getTile().items;
	if(items.length === 0)
		return false;
	if(items.length === 1){
		//Pickup the single item
		var item = items.pop();

		if(!item.pickup()){
			Game.addMessage("cant lift "+item.description);
			items.push(item);
			return false;
		}

		Game.addMessage("picking up "+item.description);
		if(item instanceof Limb){
			if(!this.addLimb(item)){
				Game.addMessage('the '+item.description+" won't attach");
				items.push(item);
				return false;
			}
			Game.addMessage('your new '+item.description+' feels ready');
		}
		this.endTurn();
		return true;
	}else{
		//Ask which item to pick up
		window.removeEventListener("keydown",this);
		var descriptions = [];
		for(var i = 0; i < items.length; i++){
			descriptions.push(items[i].describe());
		}
		descriptions.push("Cancel");
		var callback = function(chosen){
			Game.redraw();
			if(chosen >= items.length){
				window.addEventListener("keydown",this);
				return false;
			}
			var item = items.splice(chosen,1)[0];

			if(!item.pickup()){
				Game.addMessage("cant lift "+item.description);
				window.addEventListener("keydown",this);
				items.push(item);
				return false;
			}

			Game.addMessage("picking up "+item.description);

			if(item instanceof Limb){
				if(!this.addLimb(item)){
					Game.addMessage('the '+item.description+" won't attach");
					items.push(item);
					window.addEventListener("keydown",this);
					return false;
				}
				Game.addMessage('your new '+item.description+' feels ready');
			}
			this.endTurn();
			return true;
		};
		Game.prompt(descriptions,0,callback.bind(this),"PICKUP:");
	}
};
Player.prototype._kill = function(){
	LimbedCreature.prototype._kill.call(this);
	Game.engine.lock();
}

// Item root class
var Item = function(){
	this._character = '*';
	this._color = [255,255,100];
	this.description = "amorphous object";
};
Item.prototype.draw = function(x,y,brightness){
	Game.display.draw(x, y,this._character,
		ROT.Color.toHex(ROT.Color.interpolate(this._color,[0,0,0],brightness)));
};
Item.prototype.pickup = function(){
	return true;
};
Item.prototype.describe = function(){
	return this.description;
}

// Limb class
var Limb = function(params){
	Item.call(this);
	this.attack = 0;
	this.defense = 0;
	this.damage = 0;
	this.speed = 0;
	this.hp = 8;
	this._character = '/';
	this.description = "non-descript appendage";
	this.species = "unusual";
	//Apply custom params
	for(var param in params){
		this[param] = params[param];
	}
	this.hpBase = this.hp;
};
Limb.prototype = new Item();
Limb.prototype.describe = function(){
	return this.species + " "+this.description;
}

//List of predefined limbs
var Limbs = {
	// Human Limbs
	humanArm: {attack:10,damage:5, description: "arm", species: "human"},
	humanSwordArm: {attack:20,damage:10,defense:20, description: "arm holding a sword", species: "human"},
	humanShieldArm: {attack:5,damage:2,defense:60, description: "arm holding a shield", species: "human"},
	humanLeg: {speed:50,hp:15, description: "leg", species: "human"},

	// Rodent Limbs
	ratLeg: {attack:2, damage: 1, speed: 20, hp: 3, description: "leg", species: "rat"},

	// Beast Limbs
	dogLeg: {attack: 2, damage: 3, speed: 40, hp: 5, description: "leg", species: "dog"},
	wolfLeg: {attack: 2, damage: 4, speed: 50, hp: 6, description: "leg", species: "wolf"},
	bearLeg: {attack: 14, damage: 12, speed: 20, hp: 12, description: "leg", species: "bear"},

	// Small Monster Limbs
	goblinArm: {attack: 7, damage: 5, defense: 10, description: "arm", species: "goblin"},
	goblinDaggerArm: {attack: 14, damage: 7, defense: 15, description: "arm holding a dagger", species: "goblin"},
	goblinBucklerArm: {attack: 4, damage: 2, defense: 40, description: "arm holding a buckler", species: "goblin"},
	goblinLeg: {speed: 40, hp: 13, description: "leg", species: "goblin"},

	koboldArm: {attack: 5, damage: 4, defense: 7, description: "arm", species: "kobold"},
	koboldDaggerArm: {attack: 12, damage: 6, defense: 13, description: "arm holding a dagger", species: "kobold"},
	koboldLeg: {speed: 60, hp: 10, description: "leg", species: "kobold"},

	// Medium Monster Limbs
	orcArm: {attack: 10, damage: 7, hp: 10,description: "arm", species: "orc"},
	orcHammerArm: {attack: 13, damage: 15,hp: 10, description: "arm holding a hammer", species: "orc"},
	orcAxeArm: {attack: 18, damage: 12, defense: 13, hp: 10,description: "arm holding an axe", species: "orc"},
	orcLeg: {speed:40,hp:20, description: "leg", species: "orc"},

	// Large Monster Limbs
	trollArm: {attack: 13, damage: 11, hp: 15,description: "arm", species: "troll"},
	trollClubArm: {attack: 18, damage: 20,hp: 15, description: "arm holding a club", species: "troll"},
	trollLeg: {speed:20,hp:30, description: "leg", species: "orc"},	
};

var Monsters = [
	{
		limbs:[Limbs.ratLeg, Limbs.ratLeg, Limbs.ratLeg, Limbs.ratLeg], 
		description: 'rat', 
		species: 'rat', 
		attack: 6, 
		defense: 10, 
		damage: 3, 
		hp: 5,
		level: 0
	},
	{
		limbs:[Limbs.dogLeg, Limbs.dogLeg, Limbs.dogLeg, Limbs.dogLeg], 
		description: 'dog', 
		species: 'dog', 
		attack: 15, 
		defense: 20, 
		damage: 6, 
		hp: 10,
		level: 1
	},
	{
		limbs:[Limbs.wolfLeg, Limbs.wolfLeg, Limbs.wolfLeg, Limbs.wolfLeg], 
		description: 'wolf', 
		species: 'wolf', 
		attack: 15, 
		defense: 25, 
		damage: 8, 
		hp: 15,
		level: 3
	},
	{
		limbs:[Limbs.bearLeg, Limbs.bearLeg, Limbs.bearLeg, Limbs.bearLeg], 
		description: 'bear', 
		species: 'bear', 
		attack: 20, 
		defense: 50, 
		damage: 15, 
		hp: 30,
		level: 3
	},
	{
		limbs:[Limbs.goblinDaggerArm, [Limbs.goblinArm, Limbs.goblinBucklerArm], Limbs.goblinLeg, Limbs.goblinLeg], 
		description: 'goblin', 
		species: 'goblin', 
		attack: 0, 
		defense: 40, 
		damage: 3, 
		hp: 20,
		level: 2
	},
	{
		limbs:[Limbs.koboldDaggerArm, Limbs.koboldArm, Limbs.koboldLeg, Limbs.koboldLeg], 
		description: 'kobold', 
		species: 'kobold', 
		attack: 0, 
		defense: 30, 
		damage: 4, 
		hp: 16,
		level: 1
	},
	{
		limbs:[[Limbs.orcHammerArm, Limbs.orcAxeArm], Limbs.orcArm, Limbs.orcLeg, Limbs.orcLeg], 
		description: 'orc', 
		species: 'orc', 
		attack: 0, 
		defense: 45, 
		damage: 3, 
		hp: 30,
		level: 3
	},
	{
		limbs:[Limbs.trollClubArm, Limbs.trollArm, Limbs.trollLeg, Limbs.trollLeg], 
		description: 'troll', 
		species: 'troll', 
		attack: 10, 
		defense: 30, 
		damage: 4, 
		hp: 40,
		level: 4
	},
];

var StaticItem = function(description, character, color){
	Item.call(this);
	this.description = description;
	this._character = (character ? character : 'x');
	this._color = (color ? color : [80,80,80]);
};
StaticItem.prototype = new Item();
StaticItem.prototype.pickup = function(){ return false; };


var Structure = function(description, character, color, use){
	this._character = character ? character : '?';
	this._color = color ? color : [255,100,255];
	this.description = description;
	this.use = use;
};
Structure.prototype.draw = function(x,y,brightness){
	Game.display.draw(x, y,this._character,
		ROT.Color.toHex(ROT.Color.interpolate(this._color,[0,0,0],brightness)));
};

