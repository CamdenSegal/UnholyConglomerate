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
		this._drawVisibleMap(40,12,10);
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
		}

		digger.create(digCallback.bind(this));

		this._createPlayer();
	},

	_createPlayer: function() {
		this.player = new Player(40,12);
		this.engine.addActor(this.player);
	},

	_drawVisibleMap: function(x,y,r){
		var fov = new ROT.FOV.PreciseShadowcasting(this._lightPasses.bind(this));

		var fovCallback = function(x,y,d,visibility){
			this.map[x][y].draw(x,y,d/r);
		}
		fov.compute(x,y,r,fovCallback.bind(this));
		this.player.draw();
	},

	_lightPasses : function(x,y){
		return this.map[x][y].lightPasses;
	}
}

//Tile classes
var Tile = function(params){
	this.character = '*';
	this.fg = [255,255,255];
	this.bg = [0,0,0];
	this.description = "a point in space";
	this.lightPasses = true;
	for(var param in params){
		this[param] = params[param];
	}
}
Tile.prototype.draw = function(x, y, brightness){
	Game.display.draw(x,y,this.character,ROT.Color.toHex(ROT.Color.interpolate(this.fg,[0,0,0],brightness)),ROT.Color.toHex(ROT.Color.interpolate(this.bg,[0,0,0],brightness)));
}

var FloorTile = function(params){
	Tile.call(this, params);
	this.character = '.';
	this.fg = ROT.Color.randomize([230,230,230],[20,20,10]);
	this.description = "open floor";
	for(var param in params){
		this[param] = params[param];
	}
}
FloorTile.prototype = new Tile();

var WallTile = function(params){
	Tile.call(this, params);
	this.character = ' ';
	this.fg = [0,0,0];
	this.bg = ROT.Color.randomize([250,250,250],[5,5,5]);
	this.description = "rock wall";
	this.lightPasses = false;
	for(var param in params){
		this[param] = params[param];
	}
}
WallTile.prototype = new Tile();

//Actor class
var Actor = function(x,y){
	this._x = x;
	this._y = y;
	this._speed = 100;
	this._character = 'M';
	this._color = [255,100,100];
}
Actor.prototype.draw = function(){
	Game.display.draw(this._x, this._y,this._character, ROT.Color.toHex(this._color));
}
Actor.prototype.getSpeed = function(){
	return this._speed;
}

var Player = function(x,y) {
	Actor.call(this,x,y);
	this._character = '@';
	this._color = [100,255,100];
}
Player.prototype = new Actor();
