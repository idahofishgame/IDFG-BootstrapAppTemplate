require([
	"esri/config",
	"esri/urlUtils",
	"esri/map",
	"esri/dijit/LocateButton",
	"esri/dijit/Scalebar",
	"esri/request",
	"esri/geometry/scaleUtils",
	"esri/layers/FeatureLayer",
	"esri/renderers/SimpleRenderer",
	"esri/symbols/PictureMarkerSymbol",
	"esri/symbols/SimpleMarkerSymbol",
	"esri/symbols/SimpleFillSymbol",
	"esri/symbols/SimpleLineSymbol",
	"esri/symbols/TextSymbol",
	"esri/symbols/Font",
	"esri/Color",
	"esri/geometry/Point",
	"esri/geometry/Multipoint", 
	"esri/arcgis/utils",
	"esri/geometry/webMercatorUtils",
	"esri/layers/GraphicsLayer",
	"esri/dijit/BasemapLayer",
	"esri/dijit/Basemap",
	"esri/dijit/BasemapGallery",
	"agsjs/layers/GoogleMapsLayer",
	"esri/InfoTemplate",
	"esri/dijit/Popup",
	"esri/dijit/PopupTemplate",
	"esri/layers/ArcGISDynamicMapServiceLayer",
	"esri/layers/WMSLayer",
	"esri/tasks/QueryTask",
	"esri/tasks/query",
	"agsjs/dijit/TOC",
	"esri/dijit/Geocoder",
	"esri/tasks/GeometryService",
	"esri/dijit/Measurement",
	"esri/toolbars/draw",
	"esri/graphic",
	"esri/tasks/PrintParameters",
	"esri/tasks/PrintTemplate",
	"esri/tasks/PrintTask",
	"dojo/dom",
	"dojo/dom-class",
	"dojo/dom-construct",
	"dojo/json",
	"dojo/on",
	"dojo/parser",
	"dojo/query",
	"dojo/sniff",
	"dojo/_base/connect",
	"dojo/_base/array",
	"dojo/_base/lang",
	"dijit/registry",
	"application/bootstrapmap",
	"dojo/domReady!"
],
	function (
	esriConfig, urlUtils, Map, LocateButton, Scalebar, request, scaleUtils, FeatureLayer, SimpleRenderer, PictureMarkerSymbol, SimpleMarkerSymbol, SimpleFillSymbol, SimpleLineSymbol, TextSymbol, Font, Color, Point, Multipoint, arcgisUtils, webMercatorUtils, GraphicsLayer, BasemapLayer, Basemap, BasemapGallery, GoogleMapsLayer, InfoTemplate, Popup, PopupTemplate, ArcGISDynamicMapServiceLayer, WMSLayer, QueryTask, Query, TOC, Geocoder, GeometryService, Measurement, Draw, Graphic, PrintParameters, PrintTemplate, PrintTask, dom, domClass, domConstruct, JSON, on, parser, query, sniff, connect, arrayUtils, lang, registry, BootstrapMap
) {
		
		//Proxy settings
		esriConfig.defaults.io.proxyUrl = "http://fishandgame.idaho.gov/ifwis/gis_proxy/proxy.ashx?";
		esriConfig.defaults.io.alwaysUseProxy = false;
		
		urlUtils.addProxyRule({
			urlPrefix: "http://fishandgame.idaho.gov",
			proxyUrl: "http://fishandgame.idaho.gov/ifwis/gis_proxy/proxy.ashx"
    });
		
		// call the parser to create the dijit layout dijits
		parser.parse(); // note djConfig.parseOnLoad = false;
		
		//hide the loading icon after the window has loaded.
		$(window).load(function(){
			$("#loading").hide();
			clearFileInputField(uploadForm);
		});
		
		//create a popup div
		var popup = Popup({
			titleInBody: false
		},domConstruct.create("div"));
		
		//Get a reference to the ArcGIS Map class
		map = BootstrapMap.create("mapDiv",{
			basemap:"topo",
			center:[-114.52,45.50],
			zoom:6,
			infoWindow: popup
		});
		
		//create a domClass to customize the look of the popup window
		domClass.add(map.infoWindow.domNode, "myTheme");
		

		//LocateButton will zoom to where you are.  If tracking is enabled and the button becomes a toggle that creates an event to watch for location changes.
		var locateSymbol = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_CIRCLE, 20,
			new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID,
			new Color([215,73,255, 0.8]), 8),
			new Color ([199,0,255, 0.8]));
		
		geoLocate = new LocateButton({
			map: map,
			symbol: locateSymbol
			//useTracking: true //I have not tested this option but it could be cool for some applications.
    }, "LocateButton");
    geoLocate.startup();
		
		//add scalebar
		scalebar = new Scalebar({
			map: map,
			scalebarUnit: "dual"
		});
		
		var placeLayer, zoomToLayer, zoomToLabelLayer, drawToolbarLayer, drawTextLayer;
		map.on("load", function() {
		//after map loads, connect to listen to mouse move & drag events
			map.on("mouse-move", showCoordinates);
			map.on("mouse-drag", showCoordinates);
		//add graphics layer for the hunt areas query
			queryLayer = new GraphicsLayer();
			map.addLayer(queryLayer);
			queryLabelLayer = new GraphicsLayer();
			map.addLayer(queryLabelLayer);
		//add graphics layers for graphic outputs from the various tools (Place Search, Coordinate Search w/label, Draw shapes, Draw text)	
			placeLayer = new GraphicsLayer();
			map.addLayer(placeLayer);
			zoomToLayer = new GraphicsLayer();
			map.addLayer(zoomToLayer);
			zoomToLabelLayer = new GraphicsLayer();
			map.addLayer(zoomToLabelLayer);
		//add graphics layers for toolbar shapes and text.  Must be separated into different layers or they will not print properly on the map.
			drawToolbarLayer = new GraphicsLayer();
			map.addLayer(drawToolbarLayer);
			drawTextLayer = new GraphicsLayer();	
			map.addLayer(drawTextLayer);
			map.reorderLayer(drawTextLayer,1);
		});
	
		
		//show coordinates as the user scrolls around the map. In Desktop, it displays where ever the mouse is hovering.  In mobile, the user must tap the screen to get the coordinates.
		function showCoordinates(evt) {
			//the map is in web mercator but display coordinates in geographic (lat, long)
			var mp = webMercatorUtils.webMercatorToGeographic(evt.mapPoint);
			//display mouse coordinates
			$("#info").html(mp.x.toFixed(3) + ", " + mp.y.toFixed(3));
		}
		
		//add the basemap gallery, in this case we'll display maps from ArcGIS.com including bing maps
		basemapGallery = new BasemapGallery({
			showArcGISBasemaps: true,
			map: map,
		}, "basemapDiv");
		basemapGallery.startup();
		
		basemapGallery.on("error", function(msg) {
			console.log("basemap gallery error:  ", msg);
		});
		
		$("#basemapDiv").click (function(){
			//If a google basemap was previously selected, remove it to see the esri basemap (google maps are 'on top of' esri maps)
			map.removeLayer(googleLayer);
			$("#basemapModal").modal('hide');
		});
		
		$(".esriBasemapGalleryNode").click (function(){
			$("#basemapModal").modal('hide');
		});
		
		//Add the USA Topo basemap to the basemap gallery. It is not part of the gallery by default.  You can add other esri or custom basemaps.
		var layer = new esri.dijit.BasemapLayer({url:"http://services.arcgisonline.com/ArcGIS/rest/services/USA_Topo_Maps/MapServer"});
		var basemap = new esri.dijit.Basemap({
			layers:[layer],
			title:"USGS Topo",
			thumbnailUrl:"src/images/usa_topo.jpg"
		});
		basemapGallery.add(basemap);

		//Add Google Map basemap layers to the basemap gallery.  NOTE: GOOGLE BASEMAPS WILL NOT PRINT. Make sure your users know they must select an if they are going to create a Printable Map. 
		googleLayer = new agsjs.layers.GoogleMapsLayer({
			id: 'google',
			apiOptions: {
				v: '3.6' // use a specific version is recommended for production system. 
			},
			mapOptions: {
				streetViewControl: false // use false if do not want street view. Default is true.
			}
		});
				
		$("#googleRoads").click (function(){
				map.addLayer(googleLayer);
				map.reorderLayer(googleLayer, 1);
				googleLayer.setMapTypeId(agsjs.layers.GoogleMapsLayer.MAP_TYPE_ROADMAP);
		});
		
		$("#googleSatellite").click (function(){
				map.addLayer(googleLayer);
				map.reorderLayer(googleLayer, 1);
				googleLayer.setMapTypeId(agsjs.layers.GoogleMapsLayer.MAP_TYPE_SATELLITE);
		});
		
		$("#googleHybrid").click (function(){
				map.addLayer(googleLayer);
				map.reorderLayer(googleLayer, 1);
				googleLayer.setMapTypeId(agsjs.layers.GoogleMapsLayer.MAP_TYPE_HYBRID);
		});
		
		$("#googleTerrain").click (function(){
				map.addLayer(googleLayer);
				map.reorderLayer(googleLayer, 1);
				googleLayer.setMapTypeId(agsjs.layers.GoogleMapsLayer.MAP_TYPE_TERRAIN);
		});

		//popup window template for the Campground feature layer
		var campgroundPopupTemplate = new PopupTemplate({
			title: "Campground Info",
			fieldInfos:[{
				fieldName: "NAME", visible: true,
				fieldName: "Phone", visible: true,
				fieldName: "Rate", visible: true,
				fieldName: "Season", visible: true,
				fieldName: "Sites", visible: true,
				fieldName: "Max_Length", visible: true,
				fieldName: "Type", visible: true,
				fieldName: "URL", visible: true
				}]
		});	
		campgroundPopupTemplate.setContent(
			"<b>Name: </b>${NAME}<br/>" +
			"<b>Phone: </b>${Phone}</br>" +
			"<b>Fee/Rate: </b>${Rate}</br>" +
			"<b>Season: </b>${Season}</br>" +
			"<b># of Sites: </b>${Sites}</br>" +
			"<b>Max # of Days at Site*: </b>${Max_Length}</br>" +
			"<b>* </b> 0 = No Limit</br>" +
			"<b>Site Administrator: </b>${Type}</br>"
		);

		//add layers (or groups of layers) to the map via ArcGISDynamicMapServiceLayer or FeatureLayer.
		adminLayers = new ArcGISDynamicMapServiceLayer("https://fishandgame.idaho.gov/gis/rest/services/Data/AdministrativeBoundaries/MapServer",
			{id:"Adminstrative Boundary"});
		surfaceMgmtLayer = new FeatureLayer("https://fishandgame.idaho.gov/gis/rest/services/Basemaps/SurfaceMgmt_WildlifeTracts/MapServer/0",
			{
				id:"Surface_Management",
				opacity: 0.5
			});
		trailLayers = new ArcGISDynamicMapServiceLayer("http://gis2.idaho.gov/arcgis/rest/services/DPR/IDTrailsSimple/MapServer",
			{id:"Trails_and_Roads"});
		campgroundLayer = new FeatureLayer("https://gis2.idaho.gov/arcgis/rest/services/ADM/Campgrounds/MapServer/0",
			{
				id:"Campgrounds",
				outFields:["*"],
				infoTemplate:campgroundPopupTemplate
			});
	
		//add the Table of Contents.  Layers can be toggled on/off. Symbology is displayed.  Each "layer group" has a transparency slider.
		map.on('load', function(evt){
			// overwrite the default visibility of service. TOC will honor the overwritten value.
			trailLayers.setVisibleLayers([2,3,4,5,6,7,8,9,10,11]);
				toc = new TOC({
					map: map,
					layerInfos: [{
						layer: adminLayers,
						title: "Administrative Boundaries",
						collapsed:true,
						slider: true
					}, {
						layer: surfaceMgmtLayer,
						title: "Land Management Layer",
						collapsed: true,
						slider:true
					}, {
						layer: trailLayers,
						title: "Roads & Trails (zoom in to activate)",
						collapsed: true,
						slider: true
					}, {
						layer: campgroundLayer,
						title: "Campgrounds",
						collapsed: true,
						slider: true	
					}]
					}, 'tocDiv');
				toc.startup();
				
				toc.on('load', function(){
					//toggle layers/on by click root/layer labels (as well as checking checkbox)
					$('.agsjsTOCServiceLayerLabel').click(function(){
						$(this).siblings('span').children('input').click();
					});
					//Append a div to these layer names in the 'Turn Layers On/Off' window to add hyperlinks to data steward websites.
					$("#TOCNode_Surface_Management .agsjsTOCRootLayerLabel").append("<div class='disclaimer'>Maintained by BLM. <a href='http://cloud.insideidaho.org/webApps/metadataViewer/default.aspx?path=G%3a%5cdata%5canonymous%5cblm%5cRLTY_SMA_PUB_24K_POLY.shp.xml' target='_blank'>Learn More</a></div>");
					$("#TOCNode_Trails_and_Roads .agsjsTOCRootLayerLabel").append("<div class='disclaimer'>Maintained by IDPR. <a href='http://www.trails.idaho.gov/trails/' target='_blank'>Learn More</a></div>");
					$("#TOCNode_Campgrounds .agsjsTOCRootLayerLabel").append("<div class='disclaimer'>Maintained by IDPR. <a href='http://parksandrecreation.idaho.gov/activities/camping' target='_blank'>Learn More</a></div>");
/* 					$('.agsjsTOCRootLayerLabel').click(function(){
						$(this).siblings('span').children('input').click();
					}); */
				});
		});
		
		map.addLayers([surfaceMgmtLayer, adminLayers, trailLayers, campgroundLayer]);
		adminLayers.hide(); //So none of the layers are "on" when the map first loads.
		surfaceMgmtLayer.hide();
		trailLayers.hide();
		campgroundLayer.hide();
		map.reorderLayer(surfaceMgmtLayer, 0);
		
		//Enable mobile scrolling by calling off the dropdown list in the 'Highlight an Area' modal $('.selectpicker').selectpicker('mobile'). The method for detecting the browser is left up to the user. This enables the device's native menu for select menus.
		if( /Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent) ) {
			$('.selectpicker').selectpicker('mobile');
		}
		
		//function to get variable values from the URL to zoom to a specific center coordinate and zoom level if using a "shared" map view link.
		function getVariableByName(name) {
			var query = window.location.search.substring(1);
			var vars = query.split("&");
			for (var i=0; i < vars.length;i++){
				var variableName = vars[i].split('=');
				if (variableName[0] == name)
				{
					return variableName[1]
				}
			}
		}
		
		//get the variables of areaID (hunt area, IOG area, or Access Yes! area), layerID (which layer to apply the ID query to), and label (what will appear in the legend).
		var gameDistributionID, layerID, label, urlZoom, urlX, urlY, homeURL, zoomLevel, centerpoint, cX, cY, newURL;	
		var urlZoom, urlX, urlY, homeURL, zoomLevel, centerpoint, cX, cY, newURL;	
		window.onload = function(){
			$('.selectpicker').selectpicker('val', '');
			urlZoom = getVariableByName('zoom');
			urlX = getVariableByName('X');
			urlY = getVariableByName('Y');
			
			if (typeof urlZoom != 'undefined'){
				var point = new Point(urlX, urlY, new SpatialReference({ wkid: 4326}));
				map.setLevel(urlZoom);
				map.centerAt(point);
			}
		};
		
		//On extent change, change the share url zoom and coordinate parameters and refresh the "share" url.
		map.on("extent-change", function(){
			$("#viewURL").empty();
				homeURL = window.location.href;
				zoomLevel = map.getZoom();
				centerpoint = webMercatorUtils.webMercatorToGeographic(map.extent.getCenter());
				cX = parseFloat(centerpoint.x.toFixed(3));
				cY = parseFloat(centerpoint.y.toFixed(3));
				newURL ="?zoom=" + zoomLevel + "&X=" + cX + "&Y=" + cY;
				$("#viewURL").append(homeURL + newURL);
		});
		
		//toggle query layer on/off when checkbox is toggled on/off
		$("#queryCheckbox").change(function(){	
		 if ($(this).prop('checked')) {
		  queryLayer.show();
			queryLabelLayer.show();
		 } else {
		  queryLayer.hide();
			queryLabelLayer.hide();
		 }
		});

		var gameDistributionID, newHighlight1;
		
		$("#btnQuery").click(function(){
			$("#loading").show();
			queryLayer.clear();
			queryLabelLayer.clear();
			$("#queryLabel1Div").hide();
			$("#kmlNav1").hide();
			$("#kmlNav2").hide();
			
			//get variable values from the dropdown lists in the highlight an area modal window and run doQuery.
			if ($("#gameDistribution").val()){
				var gameDistributionTypeValue = "";
				$("#gameDistribution option:selected").each(function() {
					gameDistributionTypeValue += "'" + $(this).val() + "',";
				})
			//Remove trailing comma
				gameDistributionID = gameDistributionTypeValue.substring(0,gameDistributionTypeValue.length - 1);
				var layerID = "7";
				var label0 = $("#gameDistribution option:selected").map(function(){
					return $(this).text();
				}).get();
				var label = label0.join(", ") + " General Distribution";
				
				if (typeof label != 'undefined'){
					label = label;
				} else {
					label = "Selected Game Distribution";
				}
				if (typeof gameDistributionID != 'undefined'){
					doQuery1(gameDistributionID, label);
				}
				$("#queryLabel1").text(label);
				$("#queryLabel1Div").show();
				
				//Create a KML of the user-selected game animal distributions, show the 'Download Highlighted Areas as KML' tool, and highlight it for a short period to get the users attention.
				var gameDistributionKMLlink = "https://fishandgame.idaho.gov/gis/rest/services/Apps/HuntPlanner_V2/MapServer/7/query?where=ID in (" + gameDistributionID + ")&outfields=SCINAME,NAME&f=kmz"
				$("#gameDistributionKML").attr("href", gameDistributionKMLlink);
				$("#gameDistributionKML").show();
			}
			
		if ($("#gameDistribution").val() != null){
			$("#kmlNav1").show();
			$("#kmlNav2").show();
			$("#kmlNav1").effect("highlight", {color: 'yellow'}, 3000);
			$("#kmlNav2").effect("highlight", {color: 'yellow'}, 3000);
		}
		
			$("#highlightModal").modal('hide');
		});
			
		$("#btnClearHighlighted").click(function(){
			queryLayer.clear();
			queryLabelLayer.clear();
			$("#queryLabelDiv").hide();
			$('.selectpicker').selectpicker('val', '');
			$("#queryLabel1Div").hide();
			$("#kmlNav1").hide();
			$("#kmlNav2").hide();;
			$("#gameDistributionKML").hide();
		})
		
		function doQuery1(gameDistributionID, label) {
			//initialize query tasks
			newQueryTask1 = new QueryTask("https://fishandgame.idaho.gov/gis/rest/services/Apps/HuntPlanner_V2/MapServer/7");

			//initialize query
			newQuery1 = new Query();
			newQuery1.returnGeometry = true;
			newQuery1.outFields = ["ID", "SCINAME","NAME"]
			newHighlight1 = new SimpleFillSymbol(SimpleFillSymbol.STYLE_SOLID,
				new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID,
				new Color([154,32,219]), 3),
				new Color([154,32,219,0.1])
			);
			
			newQuery1.where = "ID IN (" + gameDistributionID + ")";
			newQueryTask1.execute (newQuery1, showResults1);
		}
		
		function showResults1(featureSet) {
			//Performance enhancer - assign featureSet array to a single variable.
			var newFeatures1 = featureSet.features;
			//Loop through each feature returned
			for (var i=0, il=newFeatures1.length; i<il; i++) {
				//Get the current feature from the featureSet.
				//Feature is a graphic
				var geometry = featureSet.geometry;
				var newGraphic1 = newFeatures1[i];
				var polyExtent = newGraphic1.geometry.getExtent();
				var polyCenter = polyExtent.getCenter();
				newGraphic1.setSymbol(newHighlight1);
				queryMapLabel1 = newGraphic1.attributes.NAME + " General Distribution";
				//Add graphic to the map graphics layer.
				queryLayer.add(newGraphic1);
				
				//Add label to the graphics.		
				var font = new esri.symbol.Font();
				font.setSize("10pt");
				font.setFamily("Helvetica");
				font.setWeight(Font.WEIGHT_BOLD);
				var textSymbol = new TextSymbol(queryMapLabel1);
				textSymbol.setColor (new esri.Color([154,32,219]));
				textSymbol.setFont(font);
				textSymbol.setHorizontalAlignment("center");
				textSymbol.setVerticalAlignment("middle");
				textSymbol.setOffset(17, 0);
				//Add label at the selected area center.
				var pt = new Point(polyCenter,map.spatialReference);
				var queryMapLabel1Graphic = new Graphic (pt, textSymbol);
				queryLabelLayer.add(queryMapLabel1Graphic);
				
				var selectionExtent = esri.graphicsExtent(newFeatures1);
				map.setExtent(selectionExtent.expand(1.25), true);
				
				//Zoom to graphics extent.
					var selectionExtent = esri.graphicsExtent(newFeatures1);
					map.setExtent(selectionExtent.expand(1.25), true);
					$("#loading").hide();
			}
			
			//Populate the queryLabel Div that will show the query result label in the legend.
			$("#queryLabelDiv").show();
			$("#queryCheckbox").prop('checked', true);
		}
		
		//Allow users to add GPX data to the map.  Other formats may be added later, such as KML.
		var layer, name;
		var layers=[];
		var portalUrl = 'http://www.arcgis.com';
		
		 on(dom.byId("uploadForm"), "change", function (evt) {
			var fileName = evt.target.value.toLowerCase();
			if (sniff("ie")) { //filename is full path in IE so extract the file name
				var arr = fileName.split("\\");
				fileName = arr[arr.length - 1];
			}
			if (fileName.indexOf(".gpx") !== -1) {//is file a gpx - if not notify user 
				generateFeatureCollection(fileName);
			}else{
				$("#upload-status").html('<p style="color:red">INVALID FILE TYPE. Choose a .gpx file</p>');
		 }
		});

      function generateFeatureCollection(fileName) {
       
        name = fileName.split(".");
        //Chrome and IE add c:\fakepath to the value - we need to remove it
        //See this link for more info: http://davidwalsh.name/fakepath
        name = name[0].replace("c:\\fakepath\\","");
        
        $("#upload-status").html("<b>Loading… </b>" + name); 
        
        //Define the input params for generate see the rest doc for details
        //http://www.arcgis.com/apidocs/rest/index.html?generate.html
        var params = {
          'name': name,
          'targetSR': map.spatialReference,
          'maxRecordCount': 1000,
          'enforceInputFileSizeLimit': true,
          'enforceOutputJsonSizeLimit': true
        };
        //generalize features for display Here we generalize at 1:40,000 which is approx 10 meters 
        //This should work well when using web mercator.  
        var extent = scaleUtils.getExtentForScale(map,40000); 
        var resolution = extent.getWidth() / map.width;
        params.generalize = true;
        params.maxAllowableOffset = resolution;
        params.reducePrecision = true;
        params.numberOfDigitsAfterDecimal = 0;
        
        var myContent = {
          'filetype': 'gpx',
          'publishParameters': JSON.stringify(params),
          'f': 'json',
          'callback.html': 'textarea'
        };
        //use the rest generate operation to generate a feature collection from the zipped shapefile 
        request({
          url: portalUrl + '/sharing/rest/content/features/generate',
          content: myContent,
          form: dom.byId('uploadForm'),
          handleAs: 'json',
          load: lang.hitch(this, function (response) {
            if (response.error) {
              errorHandler(response.error);
              return;
            }
						var layerName = response.featureCollection.layers[0].layerDefinition.name;
            $("#upload-status").html("<b>Loaded: </b>" + layerName);
            addGPXToMap(response.featureCollection);
          }),
          error: lang.hitch(this, errorHandler)
        });
      }
      function errorHandler(error) {
        $("#upload-status").html("<p style='color:red'>" + error.message + "</p>");
      }
      function addGPXToMap(featureCollection) {
        //add the GPX to the map and zoom to the feature collection extent
        //If you want to persist the feature collection when you reload browser you could store the collection in 
        //local storage by serializing the layer using featureLayer.toJson()  see the 'Feature Collection in Local Storage' sample
        //for an example of how to work with local storage. 
        var fullExtent;
				layers = [];
        arrayUtils.forEach(featureCollection.layers, function (layer) {
          var infoTemplate = new InfoTemplate("", "${*}");
					infoTemplate.setTitle(name + " Attributes");
          layer = new FeatureLayer(layer, {
						outfields:["*"],
            infoTemplate: infoTemplate
          });
          //change default symbol if desired. Comment this out and the layer will draw with the default symbology
          changeRenderer(layer);
					fullExtent = fullExtent ? fullExtent.union(layer.fullExtent) : layer.fullExtent;
          layers.push(layer);
					
        });
        map.addLayers(layers);
				map.setExtent(fullExtent.expand(1.25), true);
        $("#upload-status").html("");
				$("#uploadModal").modal('hide');
				clearFileInputField('uploadForm');
				$("#uploadLabelDiv").show();
				$("#uploadCheckbox").prop('checked', true);
      }
			
      function changeRenderer(layer) {
        //change the default symbol for the feature collection for polygons and points
        var symbol = null;
        switch (layer.geometryType) {
        case 'esriGeometryPoint':
          symbol = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_CIRCLE, 10,
							new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID,
							new Color([0,0,0]), 1),
							new Color ([255,0,0]));
          break;
        case 'esriGeometryPolygon':
          symbol = new SimpleFillSymbol(SimpleFillSymbol.STYLE_SOLID, 
						new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, 
						new Color([255, 0, 0]), 1), 
						new Color([255, 0, 0]));
          break;
        }
        if (symbol) {
          layer.setRenderer(new SimpleRenderer(symbol));
        }
				if (layer.geometryType == 'esriGeometryPoint'){
					$("#uploadLabel1Div").show();
				}
					if (layer.geometryType == 'esriGeometryPolyline'){
					$("#uploadLabel2Div").show();
				}
      }
		
		//Clear the gpx upload form file name.
		function clearFileInputField(tagId){ 
			dojo.byId(tagId).innerHTML = dojo.byId(tagId).innerHTML;
		}
		
		function layerVisibility(layer) {
      (layer.visible) ? layer.hide() : layer.show();
    }
			
		//Clear the uploaded GPX files from the map.
		$("#btnClearUpload").click (function(){
			jQuery.each(layers, function(index, value){
					layerVisibility(layers[index]);
				});
				
			$("#uploadLabelDiv").hide();
			$("#uploadLabel1Div").hide();
			$("#uploadLabel2Div").hide();
			$("#uploadCheckbox").prop('checked', false);
		});
		
		//toggle GPX layers on/off when checkbox is toggled on/off
		$("#uploadCheckbox").change(function(){	
			jQuery.each(layers, function(index, value){
				layerVisibility(layers[index]);
			});
		});		

		// Create geocoder widget
		var geocoder = new Geocoder({
			maxLocations: 10,
			autoComplete: true,
			arcgisGeocoder: true,
			map: map
		},"geosearch");        
		geocoder.startup();
		geocoder.on("select", geocodeSelect);
		geocoder.on("findResults", geocodeResults);

		// Geosearch functions
		$("#btnGeosearch").click (function(){
		geosearch();
		});

		map.on("load", function(e){
			map.infoWindow.offsetY = 35;
			map.enableScrollWheelZoom();
		});
		
		function geosearch() {
			var def = geocoder.find();
			def.then(function(res){
				geocodeResults(res);
			});
		}
		
		function geocodeSelect(item) {
			var g = (item.graphic ? item.graphic : item.result.feature);
			g.setSymbol(sym);
			addPlaceGraphic(item.result,g.symbol);
		}

		function geocodeResults(places) {
			places = places.results;
			if (places.length > 0) {
				clearPlaceLayer();
				
				var symbol = sym;
				// Create and add graphics with pop-ups
				for (var i = 0; i < places.length; i++) {
					addPlaceGraphic(places[i], symbol);
				}
				zoomToPlaces(places);
			} else {
				alert("Sorry, address or place not found.");
			}
		}
		
		var sym = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_CIRCLE, 28,
			new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID,
			new Color([255,255,255]), 2),
			new Color ([29,0,255]));

		//add graphic to show geocode results
		function addPlaceGraphic(item,symbol)  {
			var place = {};
			var attributes,pt, graphic;
			pt = item.feature.geometry;
			place.address = item.name;
			// Graphic components
			attributes = { address:place.address, lat:pt.getLatitude().toFixed(2), lon:pt.getLongitude().toFixed(2) };   
			//infoTemplate = new InfoTemplate("${address}","Latitude: ${lat}<br/>Longitude: ${lon}"); !!!WILL NOT PRINT IF INFOTEMPLATE IS USED!!!
			graphic = new Graphic(pt,symbol,attributes);
			// Add to map
			placeLayer.add(graphic);  
		}
		
		//clear place search graphics layer
		$("#btnClearPlace").click (function(){
				placeLayer.clear();
		});
		
		//zoom to place searched for.
		function zoomToPlaces(places) {
			var multiPoint = new Multipoint(map.spatialReference);
			for (var i = 0; i < places.length; i++) {
				multiPoint.addPoint(places[i].feature.geometry);
			}
			map.setExtent(multiPoint.getExtent().expand(2.0));
		}
		
		//the user inputs a long, lat coordinate and a flag icon is added to that location and the location is centered and zoomed to on the map.
		$("#btnCoordZoom").click (function(){
			zoomToCoordinate();
		});
		
		//zoom to the coordinate and add a graphic
		function zoomToCoordinate(){
			var zoomToGraphic;
			var longitude = $("#longitudeInput").val();
			var latitude = $("#latitudeInput").val();
			var symbol = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_CIRCLE, 28,
			new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID,
			new Color([255,255,255]), 2),
			new Color ([0,0,0]));
			var pt = new esri.geometry.Point(longitude, latitude);
			var labelSymbol = new TextSymbol(longitude + ", " + latitude);
			labelSymbol.setColor (new esri.Color("black"));
			var font = new Font();
			font.setSize("14pt");
			font.setFamily("Helvetica");
			font.setWeight(Font.WEIGHT_BOLD);
			labelSymbol.setFont(font);
			labelSymbol.setHorizontalAlignment("left");
			labelSymbol.setVerticalAlignment("middle");
			labelSymbol.setOffset(17, 0);
			zoomToGraphic = new Graphic(pt, symbol);
			zoomToLabel = new Graphic(pt, labelSymbol);
			zoomToLayer.add(zoomToGraphic);
			zoomToLabelLayer.add(zoomToLabel);
			map.centerAndZoom(pt, 12);
		}
		
		//clear coordinate search graphics layer
		$("#btnClear").click (function(){
			zoomToLayer.clear();
			zoomToLabelLayer.clear();
		});

		//add the measurement tools
		var pms = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_CIRCLE, 10,
			new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID,
				new Color([165, 24, 221, .55], 1)));
			pms.setColor(new Color([165, 24, 221, .55]));
			pms.setSize("8");
		var sls = new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID,
			new Color([165, 24, 221, .55]), 3);
		
		var measurement = new Measurement({
			map: map,
			lineSymbol:sls,
			pointSymbol:pms
		}, dom.byId("measurementDiv"));
		measurement.startup();
		
		measurement.on("measure-end", function () {
			measurement.setTool(measurement.activeTool, false);
			var resultValue = measurement.resultValue.domNode.innerHTML;
			var copyResultValue = document.getElementById('Results');
			copyResultValue.innerHTML = resultValue;
			$("#measureResultsDiv").show();
			$("#measureResultsDiv").effect("highlight", {color: 'yellow'}, 3000);
			$("#clearMeasureResults").click(function(){
				measurement.clearResult();
				$("#measureResultsDiv").hide();	
			});
		});

		//add the Draw toolbar.
		var toolbar;
		map.on("load", createToolbar);
	
		// loop through all dijits, connect onClick event
		// listeners for buttons to activate drawing tools
		registry.forEach(function(d) {
			// d is a reference to a dijit
			// could be a layout container or a button
			if ( d.declaredClass === "dijit.form.Button" ) {
				d.on("click", activateTool);
			}
		});
		
		function activateTool() {
			var tool;
			tool = this.label.toUpperCase().replace(/ /g, "_");
			toolbar.activate(Draw[tool]);
			//}
			$("#drawModal").modal('toggle');
		}

		function createToolbar(themap) {
			toolbar = new Draw(map);
			toolbar.on("draw-end", addToMap);
		}

		function addToMap(evt) {
			var symbol;
			toolbar.deactivate();
			switch (evt.geometry.type) {
				case "multipoint":
					symbol = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_CIRCLE, 15,
						new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID,
						new Color([255,114,0]),0.5),
						new Color([255,114,0]));
					break;
				case "polyline":
					symbol = new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID,
						new Color([255,114,0]),2);
					break;
				default:
					symbol = new SimpleFillSymbol(SimpleFillSymbol.STYLE_SOLID,
					new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID,
					new Color([255,114,0]),2),
					new Color([255,114,0,0.25]));
					break; 
			}
			var drawGraphic = new Graphic(evt.geometry, symbol);
			drawToolbarLayer.add(drawGraphic);
		}
		
		//fire the text graphic in a separate graphics layer than the other draw symbols otherwise it will show as just a point when using the PrintTask GP Tool.
		$("#dijit_form_Button_10_label").on("click", drawPoint);
		
		//active the draw.POINT tool
		var pointTool;
		function drawPoint(){
			//change the tooltip text for the Draw.POINT tool.
			esri.bundle.toolbars.draw.addPoint = "Click to add text to the map.";
			pointTool = new Draw(map);
			pointTool.activate(Draw.POINT);
			pointTool.on("draw-end", addText);
		}
		//add text to the point
		function addText(evt){
			pointTool.deactivate();
			var userText = $("#userTextBox").val();
			var textSymbol= new TextSymbol(userText);
			textSymbol.setColor (new esri.Color("black"));
			var font = new Font();
			font.setSize("14pt");
			font.setFamily("Helvetica");
			font.setWeight(Font.WEIGHT_BOLD);
			textSymbol.setFont(font);
			var textGraphic = new Graphic(evt.geometry, textSymbol);
			drawTextLayer.add(textGraphic);
		};
		
		//clear all shape graphics
		$("#btnClearGraphic").click (function(){
			drawToolbarLayer.clear();
		});
		//clear all text graphics
		$("#btnClearText").click (function(){
			drawTextLayer.clear();
		});
		
		//Create PDF using PrintTask	
		$("#btnPDF").click (function(){
			$("#div_for_pdf").hide();
			submitPrint(); 
		});
		
		$("#pdfModal").on('hidden.bs.modal', function(){
			dojo.byId("printStatus").innerHTML = "";
		});
		
		function submitPrint() {
			var printParams = new PrintParameters();
			printParams.map = map;
			var status = dojo.byId("printStatus");
			status.innerHTML = "Creating Map...";
			$("#loadingPrint").show();
			
			var template = new PrintTemplate();
			var printTitle = $("#txtTitle").val();
			template.layoutOptions = {
				"titleText": printTitle
			};
			var format = $("#format").val();
			template.format = format;
			var layout = $("#layout").val();
			template.layout = layout;
			template.exportOptions = {
				dpi: 300
			};
			printParams.template = template;
			
			var printServiceUrl ='https://fishandgame.idaho.gov/gis/rest/services/Custom_IDFG_ExportWebMapTask/GPServer/Export%20Web%20Map';
			var printTask = new esri.tasks.PrintTask(printServiceUrl);	
			
			var deferred = printTask.execute(printParams);
			deferred.addCallback(function (response){  
				//alert(JSON.stringify(response));		
				status.innerHTML = "";
				//open the map PDF or image in a new browser window.
				var new_url_for_map = response.url.replace("sslifwisiis","fishandgame.idaho.gov");
				var currentTime = new Date();
				var unique_PDF_url = new_url_for_map += "?ts="+currentTime.getTime();
				//PDFwindow = window.open(new_url_for_map);
				if (typeof(PDFwindow) == 'undefined') {
					$("#div_for_pdf").html("<a href='" + unique_PDF_url + "'>CLICK HERE TO DOWNLOAD YOUR MAP</a><br/><br/>");
					$("#div_for_pdf a").attr('target', '_blank');
					$("#div_for_pdf").click(function(){
						$("#pdfModal").modal('hide');
						$("#div_for_pdf").html("");
					});
				} else {
					window.open(new_url_for_map);
					$("#pdfModal").modal('hide');
				}
				$("#div_for_pdf").show();
				$("#loadingPrint").hide();
			});
			
			deferred.addErrback(function (error) {
				console.log("Print Task Error = " + error);
				status.innerHTML = error;
			});
		};
				
		// Show modal dialog, hide nav
		$(document).ready(function(){
			//populate the Game Distribution dropdown with JSON vars.
			var gameAnimalList = [{"ID":"730","NAME":"American Badger"},{"ID":"693","NAME":"American Beaver"},{"ID":"362","NAME":"American Coot"},{"ID":"500","NAME":"American Crow"},{"ID":"723","NAME":"American Marten"},{"ID":"306","NAME":"American Wigeon"},{"ID":"318","NAME":"Barrow's Goldeneye"},{"ID":"719","NAME":"Black Bear"},{"ID":"301","NAME":"Blue-Winged Teal"},{"ID":"736","NAME":"Bobcat"},{"ID":"319","NAME":"Bufflehead"},{"ID":"747","NAME":"California Bighorn Sheep"},{"ID":"356","NAME":"California Quail"},{"ID":"295","NAME":"Canada Goose"},{"ID":"307","NAME":"Canvasback"},{"ID":"345","NAME":"Chukar"},{"ID":"302","NAME":"Cinnamon Teal"},{"ID":"352","NAME":"Columbian Sharp-Tailed Grouse"},{"ID":"317","NAME":"Common Goldeneye"},{"ID":"321","NAME":"Common Merganser"},{"ID":"722","NAME":"Common Raccoon"},{"ID":"397","NAME":"Common Snipe"},{"ID":"-700","NAME":"Deer"},{"ID":"348","NAME":"Dusky Grouse"},{"ID":"305","NAME":"Eurasian Wigeon"},{"ID":"304","NAME":"Gadwall"},{"ID":"344","NAME":"Gray Partridge"},{"ID":"310","NAME":"Greater Scaup"},{"ID":"297","NAME":"Green-Winged Teal"},{"ID":"313","NAME":"Harlequin Duck"},{"ID":"320","NAME":"Hooded Merganser"},{"ID":"311","NAME":"Lesser Scaup"},{"ID":"299","NAME":"Mallard"},{"ID":"727","NAME":"Mink"},{"ID":"740","NAME":"Moose"},{"ID":"656","NAME":"Mountain Cottontail"},{"ID":"745","NAME":"Mountain Goat"},{"ID":"734","NAME":"Mountain Lion"},{"ID":"746","NAME":"Mountain Sheep"},{"ID":"428","NAME":"Mourning Dove"},{"ID":"738","NAME":"Mule Deer"},{"ID":"708","NAME":"Muskrat"},{"ID":"354","NAME":"Northern Bobwhite"},{"ID":"300","NAME":"Northern Pintail"},{"ID":"733","NAME":"Northern River Otter"},{"ID":"303","NAME":"Northern Shoveler"},{"ID":"743","NAME":"Pronghorn"},{"ID":"660","NAME":"Pygmy Rabbit"},{"ID":"717","NAME":"Red Fox"},{"ID":"322","NAME":"Red-Breasted Merganser"},{"ID":"308","NAME":"Redhead"},{"ID":"309","NAME":"Ring-Necked Duck"},{"ID":"346","NAME":"Ring-Necked Pheasant"},{"ID":"293","NAME":"Ross's Goose"},{"ID":"323","NAME":"Ruddy Duck"},{"ID":"349","NAME":"Ruffed Grouse"},{"ID":"350","NAME":"Sage Grouse"},{"ID":"363","NAME":"Sandhill Crane"},{"ID":"292","NAME":"Snow Goose"},{"ID":"657","NAME":"Snowshoe Hare"},{"ID":"347","NAME":"Spruce Grouse"},{"ID":"737","NAME":"Wapiti Or Elk"},{"ID":"739","NAME":"White-Tailed Deer"},{"ID":"353","NAME":"Wild Turkey"},{"ID":"296","NAME":"Wood Duck"},];
			$.each(gameAnimalList, function(){
				$('#gameDistribution').append('<option value="' + this.ID + '">' + this.NAME + '</option>');
			});
			// legend nav1 menu is selected
			$("#legendNav1").click(function(e){
				$("#legendCollapse").collapse('toggle');
				// Bootstrap work-around
				$("body").css("margin-right","0px");
				$(".navbar").css("margin-right","0px");
			});
			// legend nav2 menu is selected
			$("#legendNav2").click(function(e){
				$("#legendCollapse").collapse('toggle');
				// Bootstrap work-around
				$("body").css("margin-right","0px");
				$(".navbar").css("margin-right","0px");
			});
			// highlight nav1 menu is selected
			$("#highlightNav1").click(function(e){
				$("#highlightModal").modal("show"); 
				// Bootstrap work-around
				$("body").css("margin-right","0px");
				$(".navbar").css("margin-right","0px");
			});
			// highlight nav2 menu is selected
			$("#highlightNav2").click(function(e){
				$("#highlightModal").modal("show"); 
				// Bootstrap work-around
				$("body").css("margin-right","0px");
				$(".navbar").css("margin-right","0px");
			});
			// kml nav1 menu is selected
			$("#kmlNav1").click(function(e){
				$("#kmlModal").modal("show"); 
				// Bootstrap work-around
				$("body").css("margin-right","0px");
				$(".navbar").css("margin-right","0px");
			});
			// kml nav2 menu is selected
			$("#kmlNav2").click(function(e){
				$("#kmlModal").modal("show"); 
				// Bootstrap work-around
				$("body").css("margin-right","0px");
				$(".navbar").css("margin-right","0px");
			});
			// upload nav1 menu is selected
			$("#uploadNav1").click(function(e){
				$("#uploadModal").modal("show"); 
				// Bootstrap work-around
				$("body").css("margin-right","0px");
				$(".navbar").css("margin-right","0px");
			});
			// upload nav2 menu is selected
			$("#uploadNav2").click(function(e){
				$("#uploadModal").modal("show"); 
				// Bootstrap work-around
				$("body").css("margin-right","0px");
				$(".navbar").css("margin-right","0px");
			});
			// basemap nav 1 menu is selected
			$("#basemapNav1").click(function(e){
				$("#basemapModal").modal("show"); 
				// Bootstrap work-around
				$("body").css("margin-right","0px");
				$(".navbar").css("margin-right","0px");
			});
			// basemap nav2 menu is selected
			$("#basemapNav2").click(function(e){
				$("#basemapModal").modal("show"); 
				// Bootstrap work-around
				$("body").css("margin-right","0px");
				$(".navbar").css("margin-right","0px");
			});
			// Geosearch nav1 menu is selected
			$("#geosearchNav1").click(function(e){
				$("#geosearchModal").modal("show"); 
				// Bootstrap work-around
				$("body").css("margin-right","0px");
				$(".navbar").css("margin-right","0px");
			});
			// Geosearch nav2 menu is selected
			$("#geosearchNav2").click(function(e){
				$("#geosearchModal").modal("show"); 
				// Bootstrap work-around
				$("body").css("margin-right","0px");
				$(".navbar").css("margin-right","0px");
			});
			// measurement nav1 menu is selected
			$("#measurementNav1").click(function(e){
				$("#measurementModal").modal("show"); 
				// Bootstrap work-around
				$("body").css("margin-right","0px");
				$(".navbar").css("margin-right","0px");
			});
			// measurement nav2 menu is selected
			$("#measurementNav2").click(function(e){
				$("#measurementModal").modal("show"); 
				// Bootstrap work-around
				$("body").css("margin-right","0px");
				$(".navbar").css("margin-right","0px");
			});
			// draw nav1 menu is selected
			$("#drawNav1").click(function(e){
				$("#drawModal").modal("show"); 
				// Bootstrap work-around
				$("body").css("margin-right","0px");
				$(".navbar").css("margin-right","0px");
			});
			// draw nav2 menu is selected
			$("#drawNav2").click(function(e){
				$("#drawModal").modal("show"); 
				// Bootstrap work-around
				$("body").css("margin-right","0px");
				$(".navbar").css("margin-right","0px");
			});	
			// pdf nav1 menu is selected
			$("#pdfNav1").click(function(e){
				$("#pdfModal").modal("show"); 
				// Bootstrap work-around
				$("body").css("margin-right","0px");
				$(".navbar").css("margin-right","0px");
			});
			// pdf nav2 menu is selected
			$("#pdfNav2").click(function(e){
				$("#pdfModal").modal("show"); 
				// Bootstrap work-around
				$("body").css("margin-right","0px");
				$(".navbar").css("margin-right","0px");
			});
			// help nav1 menu is selected
			$("#helpNav1").click(function(e){
				$("#helpModal").modal("show"); 
				// Bootstrap work-around
				$("body").css("margin-right","0px");
				$(".navbar").css("margin-right","0px");
			});
			// help nav2 menu is selected
			$("#helpNav2").click(function(e){
				$("#helpModal").modal("show"); 
				// Bootstrap work-around
				$("body").css("margin-right","0px");
				$(".navbar").css("margin-right","0px");
			});
			// share nav1 menu is selected
			$("#shareNav1").click(function(e){
				$("#shareModal").modal("show"); 
				// Bootstrap work-around
				$("body").css("margin-right","0px");
				$(".navbar").css("margin-right","0px");
			});
			// share nav2 menu is selected
			$("#shareNav2").click(function(e){
				$("#shareModal").modal("show"); 
				// Bootstrap work-around
				$("body").css("margin-right","0px");
				$(".navbar").css("margin-right","0px");
			});
			
			// off-canvas sidebar toggle
			$('[data-toggle=offcanvas]').click(function() {
					$(this).toggleClass('visible-xs text-center');
					$(this).find('i').toggleClass('glyphicon-chevron-right glyphicon-chevron-left');
					$('.row-offcanvas').toggleClass('active');
					$('#lg-menu').toggleClass('#sidebar hidden-xs').toggleClass('#sidebar visible-xs');
					$('#xs-menu').toggleClass('#sidebar visible-xs').toggleClass('#sidebar hidden-xs');
			});			
		});
})