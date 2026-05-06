print(table)
var table = ee.FeatureCollection("projects/researchgee/assets/PokharaMap");
var studyArea = table.geometry();

Map.centerObject(studyArea,10);
Map.addLayer(studyArea,{color: 'red'},'studyArea(union');


//  Defining the years to analyze
var startYear = 2015;
var endYear = 2026;
var years = ee.List.sequence(startYear, endYear, 1); // Every 2 years
print('Years to analyze:', years);

// Load the GHSL built-up layer for 1980


print('Number of images in GHSL Collection:', built2018.size());
// Define visualization parameters
var visParams = {
  min: 0,
  max: 100,
  palette: ['white', 'yellow', 'red'] // low values: less built-up, high values: more built-up
};

// Center the map to a region (e.g., Kathmandu, Nepal)
//Map.setCenter(85.3240, 27.7172, 6); 

// Add the built-up layer to the map
Map.addLayer(built2018, visParams, 'Built-up 2018');

for (var i = 0; i < years.length; i++) {
  var year = years[i];
  
  // Filter the image for that specific year.
  // Note: Image IDs follow the pattern 'JRC/GHSL/P2023A/GHS_BUILT_S/1990'
  var image = ee.Image('JRC/GHSL/P2023A/GHS_BUILT_S/' + year);
  
  // Select the built‑up surface band
  var builtSurface = image.select('built_surface');
  
  // Clip the image to your AOI to improve display and focus analysis
  var builtClipped = builtSurface.clip(studyArea);//aoi has been converted to studyarea here
  
  // Add to the map; the layer name includes the year
  Map.addLayer(builtClipped, visParams, 'Built-up Surface ' + year);
}
//print('Average built-up percent in Pokhara in 1980:', builtStats.get('built'));

//to see the location on map ie. inputting data on map
Map.addLayer(builtup, {}, 'builtup');
Map.addLayer(water, {}, 'water');
Map.addLayer(forest, {}, 'forest');

//area for 2019
// Load Sentinel-2 Surface Reflectance, cloud-filtered
//comment from here to clip(studyArea)
//var s2 = ee.ImageCollection('COPERNICUS/S2_SR')
 // .filterBounds(studyArea)
  //.filterDate('2019-10-01', '2019-12-31')  // Oct-Dec: dry season, less cloud
  //.filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10))
  //.select(['B2','B3','B4','B8','B11','B12'])  // Blue,Green,Red,NIR,SWIR1,SWIR2
  //.median()
  //.clip(studyArea);
  
  //Adding spectral indices for better accuracy
// NDVI - vegetation index
//var ndvi = s2.normalizedDifference(['B8', 'B4']).rename('NDVI');

// NDWI - water index
//var ndwi = s2.normalizedDifference(['B3', 'B8']).rename('NDWI');

// NDBI - built-up index
//var ndbi = s2.normalizedDifference(['B11', 'B8']).rename('NDBI');

// Stack all bands + indices
//var image = s2.addBands([ndvi, ndwi, ndbi]);
//print('Composite Image:', image);
  //
// ============================================
// FUNCTION: Get classified image for any year
// ============================================
function getClassified(year) {
  var s2 = ee.ImageCollection('COPERNICUS/S2_SR')
    .filterBounds(studyArea)
    .filterDate(year + '-10-01', year + '-12-31')
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10))
    .select(['B2','B3','B4','B8','B11','B12'])
    .median()
    .clip(studyArea);

  var ndvi = s2.normalizedDifference(['B8','B4']).rename('NDVI');
  var ndwi = s2.normalizedDifference(['B3','B8']).rename('NDWI');
  var ndbi = s2.normalizedDifference(['B11','B8']).rename('NDBI');
  var image = s2.addBands([ndvi, ndwi, ndbi]);

  return image.classify(classifier);
}

//above here till replaced

// Visualize True Color
Map.addLayer(s2, {bands: ['B4','B3','B2'], min: 0, max: 3000}, 'Sentinel-2 True Color PKR19');



// Merge all training polygons into one FeatureCollection
//Here I have featured as builtup for building, water bodies and forest only and property is set to class
var trainingData = builtup.merge(water)
                        .merge(forest);

// Sample the image at training points
var training = image.sampleRegions({
  collection: trainingData,
  properties: ['class'],
  scale: 10
});

print('Training samples:', training);

//Using model to check
// Train a Random Forest classifier as most of the LR have performed on RF
var classifier = ee.Classifier.smileRandomForest(100)
  .train({
    features: training,
    classProperty: 'class',
    inputProperties: image.bandNames()
  });

print('Classifier trained successfully');

//applying classifier to image above
var classified = image.classify(classifier);

// Define color palette for 3 classes as defined
var palette = [
  '#ff6f04',  // builtup - orange
  '#5b77d4',  // Water Bodies - Blue
  '#0b8b0b',  // Forest - Dark Green
  
];
Map.addLayer(classified, {min: 1, max: 5, palette: palette}, 'LULC Map 2019');


//Performing train-test split with (0.7:0.3)
// Split data: 70% train, 30% validate
var withRandom = trainingData.randomColumn('random');
var trainSet = withRandom.filter(ee.Filter.lt('random', 0.7));
var testSet  = withRandom.filter(ee.Filter.gte('random', 0.7));

// Re-train on training split
var classifierVal = ee.Classifier.smileRandomForest(100)
  .train({
    features: image.sampleRegions({collection: trainSet, properties: ['class'], scale: 10}),
    classProperty: 'class',
    inputProperties: image.bandNames()
  });

// Test on validation set
var validated = image.sampleRegions({
  collection: testSet,
  properties: ['class'],
  scale: 10
}).classify(classifierVal);

// Confusion matrix
var errorMatrix = validated.errorMatrix('class', 'classification');
print('Confusion Matrix:', errorMatrix);
print('Overall Accuracy:', errorMatrix.accuracy());
print("Kappa Coefficient:", errorMatrix.kappa());

// ---- EXPORT TO GOOGLE DRIVE for saving purpose----
Export.image.toDrive({
  image: classified,
  description: 'LULC_Pokhara_2019',
  folder: 'GEE_Exports',
  fileNamePrefix: 'LULC_Pokhara_2019',
  region: studyArea,
  scale: 10,
  crs: 'EPSG:4326',
  maxPixels: 1e13
});

//area for 2020
// Load Sentinel-2 Surface Reflectance, cloud-filtered
var s2_2020 = ee.ImageCollection('COPERNICUS/S2_SR')
  .filterBounds(studyArea)
  .filterDate('2020-10-01', '2020-12-31')  // Oct-Dec: dry season, less cloud
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10))
  .select(['B2','B3','B4','B8','B11','B12'])  // Blue,Green,Red,NIR,SWIR1,SWIR2
  .median()
  .clip(studyArea);

// Visualize True Color
Map.addLayer(s2_2020, {bands: ['B4','B3','B2'], min: 0, max: 3000}, 'Sentinel-2 True Color PKR20');

//area for 2021
// Load Sentinel-2 Surface Reflectance, cloud-filtered
var s2_2021 = ee.ImageCollection('COPERNICUS/S2_SR')
  .filterBounds(studyArea)
  .filterDate('2021-10-01', '2021-12-31')  // Oct-Dec: dry season, less cloud
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10))
  .select(['B2','B3','B4','B8','B11','B12'])  // Blue,Green,Red,NIR,SWIR1,SWIR2
  .median()
  .clip(studyArea);

// Visualize True Color
Map.addLayer(s2_2021, {bands: ['B4','B3','B2'], min: 0, max: 3000}, 'Sentinel-2 True Color PKR21');

//area for 2022
// Load Sentinel-2 Surface Reflectance, cloud-filtered
var s2_2022 = ee.ImageCollection('COPERNICUS/S2_SR')
  .filterBounds(studyArea)
  .filterDate('2022-10-01', '2022-12-31')  // Oct-Dec: dry season, less cloud
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10))
  .select(['B2','B3','B4','B8','B11','B12'])  // Blue,Green,Red,NIR,SWIR1,SWIR2
  .median()
  .clip(studyArea);

// Visualize True Color
Map.addLayer(s2_2022, {bands: ['B4','B3','B2'], min: 0, max: 3000}, 'Sentinel-2 True Color PKR22');

//area for 2023
// Load Sentinel-2 Surface Reflectance, cloud-filtered
var s2_2023 = ee.ImageCollection('COPERNICUS/S2_SR')
  .filterBounds(studyArea)
  .filterDate('2023-10-01', '2023-12-31')  // Oct-Dec: dry season, less cloud
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10))
  .select(['B2','B3','B4','B8','B11','B12'])  // Blue,Green,Red,NIR,SWIR1,SWIR2
  .median()
  .clip(studyArea);

// Visualize True Color
Map.addLayer(s2_2023, {bands: ['B4','B3','B2'], min: 0, max: 3000}, 'Sentinel-2 True Color PKR23');

//area for 2024
// Load Sentinel-2 Surface Reflectance, cloud-filtered
var s2_2024 = ee.ImageCollection('COPERNICUS/S2_SR')
  .filterBounds(studyArea)
  .filterDate('2024-10-01', '2024-12-31')  // Oct-Dec: dry season, less cloud
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10))
  .select(['B2','B3','B4','B8','B11','B12'])  // Blue,Green,Red,NIR,SWIR1,SWIR2
  .median()
  .clip(studyArea);

// Visualize True Color
Map.addLayer(s2_2024, {bands: ['B4','B3','B2'], min: 0, max: 3000}, 'Sentinel-2 True Color PKR24');

//area for 2025
// Load Sentinel-2 Surface Reflectance, cloud-filtered
var s2_2025 = ee.ImageCollection('COPERNICUS/S2_SR')
  .filterBounds(studyArea)
  .filterDate('2025-10-01', '2025-12-31')  // Oct-Dec: dry season, less cloud
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10))
  .select(['B2','B3','B4','B8','B11','B12'])  // Blue,Green,Red,NIR,SWIR1,SWIR2
  .median()
  .clip(studyArea);

// Visualize True Color
Map.addLayer(s2_2025, {bands: ['B4','B3','B2'], min: 0, max: 3000}, 'Sentinel-2 True Color PKR25');
