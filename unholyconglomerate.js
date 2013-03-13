var Game = {
	display: null,
	map: {},

	init: function() {
		this.display = new ROT.Display();

		document.body.appendChild(this.display.getContainer());

		var loadingText = document.getElementById("loading");
		loadingText.parentNode.removeChild(loadingText);

		this._generateMap();
		this._drawWholeMap();
	},

	_generateMap: function() {
		var digger = new ROT.Map.Digger();

		var digCallback = function(x,y,value){

			if(!this.map[x]){
				this.map[x] = {};
			}

			if(value) {
				this.map[x][y] = Tiles.wall;
			}else{
				this.map[x][y] = Tiles.floor;
			}
		}

		digger.create(digCallback.bind(this));
	},

	_drawWholeMap: function() {
		for(var x in this.map){
			for(var y in this.map[x]){
				this.display.draw(x,y,this.map[x][y].character);
			}
		}
	}
}



var Tiles = {
	floor: {character: '.',color: '#fff',description:'empty floor'},
	wall: {character: '#',color: '#fff',description:'rock wall'}
}