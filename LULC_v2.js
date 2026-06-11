// Define the date range for 2015 and 2024
var START_2018 = ee.Date('2018-01-01');
var END_2018 = ee.Date('2018-12-31');
var START_2025 = ee.Date('2025-01-01');
var END_2025 = ee.Date('2025-12-31');

//adding geographical and validated  map of pokhara in assests 
//calling pokharamap through variable and printing the details with values 
var table = ee.FeatureCollection("projects/researchgee/assets/PokharaMap");
print (table)

var centerGeometry = table.geometry().centroid();

var studyArea = table.geometry();


Map.centerObject(studyArea,10);
Map.addLayer(studyArea,{color: 'red'},'studyArea(union)');
//created a new layer with red color for study area only

// Filter Dynamic World collection for 2018 and 2025
var collection2018 = ee.ImageCollection('COPERNICUS/S2_HARMONIZED')
                .filterBounds(studyArea)
                .filterDate(START_2018, END_2018)
                .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE",50));
               

var image2018=collection2018.median();
print("2018 IMAGES WITH BANDS : ", image2018)

var ndbi2018 = image2018.normalizedDifference(['B11', 'B8']).rename('NDBI');
var builtupmask2018 = ndbi2018.gt(0);

Map.addLayer(ndbi2018.clip(studyArea),{min:-0.5, max:0.5, palette: ["blue","white","brown"]},"NDBI2018")
Map.addLayer(builtupmask2018.clip(studyArea).updateMask(builtupmask2018),{palette: ["orange"]},"Builtup 2018")

var bandMap = {
  'COPERNICUS/S2_HARMONIZED':{nir: "B8" , swir: "B12"},
  "COPERNICUS/S2_SR_HARMONIZED":{nir: "B8" , swir: "B12"}}
  
function getNDBI(image,nirBand,swirBand){
  return image.normalizedDifference([swirBand,nirBand]).rename("NDBI")
}

function maskClouds(image){
 var qa = image.select("QA60") ;
 var cloudBitMask = 1 << 10;
  var cirrusBitMask = 1 << 11;

  // Both flags should be set to zero, indicating clear conditions.
  var mask = qa.bitwiseAnd(cloudBitMask).eq(0)
      .and(qa.bitwiseAnd(cirrusBitMask).eq(0));

  return image.updateMask(mask).divide(10000); // Scaleing  the bands 
  
}

function procesYear(sensorId, startDate, endDate, yearLabel){
  var bands = bandMap[sensorId];
  var collection=ee.ImageCollection(sensorId)
  .filterDate(startDate,endDate)
  .filterBounds(studyArea);
  
  print("collection for the " + yearLabel, collection);
  print(yearLabel + "image count: ", collection.size());
  print(yearLabel + "first image: ", collection.first());
   
   var size=collection.size();
   var ndbi= ee.Algorithms.If(
     size.gt(0),
     getNDBI(collection.map(maskClouds).median().clip(studyArea),bands.nir,bands.swir),
     ee.Image().rename("NDBI").clip(studyArea)
     );
     
     return ee.Image(ndbi);
    // )
}

var ndbi2025= procesYear("COPERNICUS/S2_HARMONIZED",START_2025, END_2025,2025);
var threshold = -0.05;
var builtUp2018= ndbi2018.gt(threshold).selfMask();
var builtUp2025= ndbi2025.gt(threshold).selfMask();

Map.addLayer(builtUp2018,{palette: ["maroon"]}, "Builtup 2018")
Map.addLayer(builtUp2025,{palette: ["pink"]}, "Builtup 2025")

// calculating areas
function  calculateArea(mask,year){
  var areaImage= ee.Image.pixelArea().updateMask(mask);
  var stats= areaImage.reduceRegion({
    reducer:ee.Reducer.sum(),
    geometry: studyArea,
    maxPixels: 1e10,
  });


  
  var area= ee.Number(stats.get("area"));
  area.evaluate(function(result){
    if(result=== null) {
      
      print("builtup areas in " + year + ": No data  ");
      
    } else {
      print("Built up " + year+ ":result/1e6", km2);
    }
  }
    );
    
    calculateArea(Builtup2018, "2018");
    calculateArea(Builtup2025, "2025");
}

// Define list pairs of DW LULC labels and colors
var CLASS_NAMES = [
    'water', 'forest', 'grass',  'crops',
     'built', 'roads'];

var VIS_PALETTE = [
    '419bdf', '397d49', '88b053',  'e49635',  'c4281b',
    'a59b8f'];
    
    // Create change detection image by subtracting 2015 from 2024
//var changeDetection = collection2025.subtract(collection2015).rename('change');

// Create a visualization for the change detection
// var changeVis = changeDetection.visualize({
//     min: -8,
//     max: 8,
//     palette: ['ff0000', 'ffffff', '00ff00'] // Red for loss, white for no change, green for gain
// });

// Display the change detection
//Map.setCenter(20.6729, 52.4305, 12);
var visParamsTrueColor = {
  bands: ['water', 'forest','grass',  'crops','built', 'roads'],//replaced by bands: ['B4', 'B3', 'B2'],
  min: 0,
  max: 3000 // Sentinel-2 surface reflectance or harmonized DN values
};



// Create a legend for the Dynamic World classes
var legend = ui.Panel({
  style: {
    position: 'bottom-right',
    padding: '8px 15px'
  }
});

// Add main title to the legend
legend.add(ui.Label({
  value: 'Land Use Change Detection 2015 to 2024',
  style: {fontWeight: 'bold', fontSize: '12px', margin: '0 0 4px 0'}
}));

// Add entries for each class to the legend
CLASS_NAMES.forEach(function(name, index) {
  var color = VIS_PALETTE[index];
  var legendEntry = ui.Panel({
    widgets: [
      ui.Label({
        style: {
          backgroundColor: '#' + color,
          padding: '5px',
          margin: '0 0 4px 0',
          border: '1px solid black'
        }
      }),
      ui.Label(name)
    ],
    layout: ui.Panel.Layout.Flow('horizontal')
  });
  legend.add(legendEntry);
});

// Add the legend to the map
Map.add(legend);

// Add a title to the map
var title = ui.Label({
  value: 'Pokhara Land Use Change Detection 2015 to 2025',
  style: {fontWeight: 'bold', fontSize: '16px', margin: '10px 0'}
});
Map.add(title);

// Add a scale bar to the map
//Map.add(ui.Map.Scale());

// Add a north arrow to the map
var northArrow = ui.Label({
  value: '?',
  style: {
    position: 'top-right',
    fontSize: '24px',
    margin: '10px',
    color: 'black',
    fontWeight: 'bold'
  }
});
Map.add(northArrow);