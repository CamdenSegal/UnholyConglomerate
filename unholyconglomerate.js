var Game = {
	display: null,
	map: {},

	init: function() {
		this.display = new ROT.Display();

		document.body.appendChild(this.display.getContainer());

		var loadingText = document.getElementById("loading");
		loadingText.parentNode.removeChild(loadingText);

		this.player = null;
		this.engine = new ROT.Engine();

		this._generateMap();
		this._drawVisibleMap(40,12,14);
		this.engine.start();
	},

	_generateMap: function() {
		var digger = new ROT.Map.Digger();

		var digCallback = function(x,y,value){

			if(!this.map[x]){
				this.map[x] = {};
			}

			if(value) {
				this.map[x][y] = new WallTile();
			}else{
				this.map[x][y] = new FloorTile();
			}
		};

		digger.create(digCallback.bind(this));

		this._createPlayer();
	},

	_createPlayer: function() {
		this.player = new Player(40,12);
		this.engine.addActor(this.player);
	},

	_drawVisibleMap: function(x,y,r){
		this.display.clear();
		var fov = new ROT.FOV.PreciseShadowcasting(this._lightPasses.bind(this));

		var fovCallback = function(x,y,d,visibility){
			this.map[x][y].draw(x,y,(d/r));
		};
		fov.compute(x,y,r,fovCallback.bind(this));
		this.player.draw();
	},

	_lightPasses : function(x,y){
		if(!(x in this.map))
			return false;
		return (y in this.map[x]) ? this.map[x][y].lightPasses : false;
	},

	redraw: function(){
		this._drawVisibleMap(this.player._x,this.player._y,14);
	}
};

//Tile classes
var Tile = function(params){
	this.character = '*';
	this.fg = [255,255,255];
	this.bg = [0,0,0];
	this.description = "a point in space";
	this.lightPasses = true;
	this.walkable = true;
	for(var param in params){
		this[param] = params[param];
	}
};
Tile.prototype.draw = function(x, y, brightness){
	Game.display.draw(x,y,this.character,ROT.Color.toHex(ROT.Color.interpolate(this.fg,[0,0,0],brightness)),ROT.Color.toHex(ROT.Color.interpolate(this.bg,[0,0,0],brightness)));
};

var FloorTile = function(params){
	Tile.call(this, params);
	this.character = '.';
	this.fg = ROT.Color.randomize([230,230,230],[20,20,10]);
	this.description = "open floor";
	for(var param in params){
		this[param] = params[param];
	}
};
FloorTile.prototype = new Tile();

var WallTile = function(params){
	Tile.call(this, params);
	this.character = ' ';
	this.fg = [0,0,0];
	this.bg = ROT.Color.randomize([250,250,250],[5,5,5]);
	this.description = "rock wall";
	this.lightPasses = false;
	this.walkable = false;
	for(var param in params){
		this[param] = params[param];
	}
};
WallTile.prototype = new Tile();

//Actor class
var Actor = function(x,y){
	this._x = x;
	this._y = y;
	this._speed = 100;
	this._character = 'M';
	this._color = [255,100,100];
};
//Draw this actor on the map
Actor.prototype.draw = function(){
	Game.display.draw(this._x, this._y,this._character, ROT.Color.toHex(this._color));
};
//Execute a turn
Actor.prototype.act = function(){};
//Get the speed of the actor
Actor.prototype.getSpeed = function(){ return this._speed; };
//Attempt to move actor in desired direction
Actor.prototype.move = function(x,y){
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

	this._x = newX;
	this._y = newY;
	return true;
};

var LimbedCreature = function(x,y){
	Actor.call(this,x,y);
	this._maxLimbs = 4;
	this._limbs = [];
};
LimbedCreature.prototype = new Actor();
LimbedCreature.prototype.addLimb = function(newLimb){
	this._limbs.push(newLimb);
	return newLimb;
};

var Player = function(x,y) {
	LimbedCreature.call(this,x,y);
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
Player.prototype.act = function(){
	Game.engine.lock();
	window.addEventListener("keydown",this);
};
Player.prototype.move = function(x,y){
	if(Actor.prototype.move.call(this,x,y)){
		Game.redraw();
		return true;
	}else{
		return false;
	}
};
Player.prototype.handleEvent = function(e){
	//HANDLE KEYBOARD INPUT
	switch(e.keyCode){
		//MOVEMENT KEYS
		case ROT.VK_NUMPAD8:
		case ROT.VK_UP:
		case ROT.VK_K:
			if(!this.move(0,-1))
				return false;
			break;
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
			return false;
	}
	console.log("Player did turn");
	window.removeEventListener("keydown",this);
	Game.engine.unlock();
	return true;
};

var Limb = function(modifiers){
	this.modifiers = modifiers ? modifiers : {};
};
