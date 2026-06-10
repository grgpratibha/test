print(table)
var table = ee.FeatureCollection("projects/researchgee/assets/PokharaMap");
var studyArea = table.geometry();


Map.centerObject(studyArea,10);
Map.addLayer(studyArea,{color: 'red'},'studyArea(union');

var collection = ee.ImageCollection("COPERNICUS/S2_HARMONIZED")
    .filterBounds(studyArea)
    .filterDate('2018-01-01', '2026-05-14');

var dates = collection.map(function(img) {
  return ee.Feature(null, {'date': img.date().format('YYYY-MM-dd')});
});

print('Dates in collection:', dates.aggregate_array('date'));

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

//function for better image file 
//QA60 was updated but further for year 2020,2021,24,25 had errors extracting data , 
// further code modified as if else with QA60 and SCL
// ============================================
// ROBUST CLOUD MASK — handles ALL S2 versions
// ============================================
 //area for 2019
// Load Sentinel-2 Surface Reflectance, cloud-filtered
//comment from here to clip(studyArea)
  //
  var s2 = ee.ImageCollection('COPERNICUS/S2_SR')
  .filterBounds(studyArea)
  .filterDate('2019-08-01', '2019-12-31')  // Aug-Dec: dry season, less cloud
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10))
  .select(['B2','B3','B4','B8','B11','B12'])  // Blue,Green,Red,NIR,SWIR1,SWIR2
  .median()
  .clip(studyArea);


var ndvi = s2.normalizedDifference(['B8', 'B4']).rename('NDVI');

// NDWI - water index
var ndwi = s2.normalizedDifference(['B3', 'B8']).rename('NDWI');

// NDBI - built-up index
var ndbi = s2.normalizedDifference(['B11', 'B8']).rename('NDBI');

// Stack all bands + indices
var image = s2.addBands([ndvi, ndwi, ndbi]);
print('Composite Image:', image);

//adding legend on gee on top right side 
//it can be top rt, top lt, bottom right and bottom lt
var legend = ui.Panel({
 style: {
   position: 'top-right',
   padding: '8px 15px'
 }
});
var legendTitle = ui.Label({
 value: 'Legend',
 style: {
   fontWeight: 'bold',
   fontSize: '18px',
   margin: '0 0 4px 0',
   padding: '0'
 }
});
legend.add(legendTitle);

var palette = ['ff6f04', '5b77d4', '0b8b0b']; // Example colors
var names = ['Builtup', 'Water', 'Forest']; // Corresponding labels

var makeRow = function(color, name) {
 var colorBox = ui.Label({
   style: {
     backgroundColor: '#' + color,
     padding: '8px',
     margin: '0 0 4px 0'
   }
 });
 var description = ui.Label({
   value: name,
   style: {margin: '0 0 4px 6px'}
 });
 return ui.Panel({
   widgets: [colorBox, description],
   layout: ui.Panel.Layout.Flow('horizontal')
 });
};
for (var i = 0; i < palette.length; i++) {
 legend.add(makeRow(palette[i], names[i]));
}

Map.add(legend);

// line code change from var s2 above to composite image print
function maskS2clouds(image) {
  
  // Check if SCL band exists (new format)
  var bandNames = image.bandNames();
  var hasSCL = bandNames.contains('SCL');
  
  // SCL-based mask (new images 2022+)
  var scl = image.select('SCL');
  var sclMask = scl.neq(3)
                   .and(scl.neq(8))
                   .and(scl.neq(9))
                   .and(scl.neq(10))
                   .and(scl.neq(11));

  // QA60-based mask (old images pre-2022)
  var qa = image.select('QA60');
  var cloudBitMask  = 1 << 10;
  var cirrusBitMask = 1 << 11;
  var qa60Mask = qa.bitwiseAnd(cloudBitMask).eq(0)
                   .and(qa.bitwiseAnd(cirrusBitMask).eq(0));

  // Use SCL if available, else use QA60
  var finalMask = ee.Image(
    ee.Algorithms.If(hasSCL, sclMask, qa60Mask)
  );

  return image.updateMask(finalMask)
              .divide(10000)
              .copyProperties(image, ['system:time_start']);
             
}
// //this code from function s2mask to return image is added here for changes
  

// ============================================
// FUNCTION: Get classified image for any year update with SCL and QA60
// ============================================
//function getClassified(year) before now classifier added to look changes
function getClassified(year) {
  var s2 = ee.ImageCollection('COPERNICUS/S2_SR')
    .filterBounds(studyArea)
    //.filterDate(year + '-08-01', (parseInt(year)+1) + '-12-31')
    .filterDate('2019-08-01', '2019-12-31')
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10))
    .map(maskS2clouds)                          // mask first
    .select(['B2','B3','B4','B8','B11','B12'])  // select after
    .median()
    .clip(studyArea);
  //Adding spectral indices for better accuracy
  // NDVI - vegetation index
  var ndvi = s2.normalizedDifference(['B8','B4']).rename('NDVI');
  // NDWI - water index
  var ndwi = s2.normalizedDifference(['B3','B8']).rename('NDWI');
  // NDBI - builtup index
  var ndbi = s2.normalizedDifference(['B11','B8']).rename('NDBI');
  // Stacking all bands + indices
  var image = s2.addBands([ndvi, ndwi, ndbi]);
  return image.classify(classifier);
 
}
//above here till replaced

// Visualize True Color
Map.addLayer(s2, {bands: ['B4','B3','B2'], min: 0, max: 0.3}, 'Sentinel-2 True Color PKR19');

// Merge all training polygons into one FeatureCollection
//Here I have featured as builtup for building, water bodies and forest only and property is set to class
var trainingData = builtup.merge(water)
                        .merge(forest);
                      
//converting vector polygons to raster and painting class values on blank image
var classImage = ee.Image(0).paint({
  featureCollection: trainingData,
  color: 'class'          // use the 'class' property as pixel value
}).rename('class');       // rename band to 'class'

//verifying stratified sampling
Map.addLayer(classImage, 
  {min:1, max:3, palette:['ff6f04','5b77d4','0b8b0b']}, 
  'Class Raster', false);
  
  //  Stacking class image with base image
// ============================================
var imageWithClass = image.addBands(classImage);

// Sample the image at training points
//remove from line 156-161 as next code of stratified sampling is added here as count are good but pixels within classes are variable
var training = image.sampleRegions({
  collection: trainingData,
  properties: ['class'],
 scale: 10
});

// Stratified sampling — equal pixels per class line 164-171  added for above commented



print('Training samples:', training);



// Checking pixel count per class
print('Total training pixels:', training.size());

// Filterinng by class to see balance for each class
print('Builtup pixels:', 
  training.filter(ee.Filter.eq('class', 1)).size());
print('Water pixels:', 
  training.filter(ee.Filter.eq('class', 2)).size());
print('Forest pixels:', 
  training.filter(ee.Filter.eq('class', 3)).size());
  
  
//Using model to check
// Train a Random Forest classifier as most of the LR have performed on RF
var classifier = ee.Classifier.smileRandomForest(100)
  .train({
    features: training,
    classProperty: 'class',
    inputProperties: image.bandNames()
  });

print('Classifier trained successfully');

//adding multiple models
// SVM Classifier
var svm = ee.Classifier.libsvm({
  kernelType: 'RBF',
  gamma: 0.5,
  cost: 10
}).train({
  features: training,
  classProperty: 'class',
  inputProperties: image.bandNames()
});

// CART (Decision Tree)
var cart = ee.Classifier.smileCart()
  .train({
    features: training,
    classProperty: 'class',
    inputProperties: image.bandNames()
  });

// Gradient Tree Boost
var gtb = ee.Classifier.smileGradientTreeBoost(50)
  .train({
    features: training,
    classProperty: 'class',
    inputProperties: image.bandNames()
  });

// Compare accuracy across classifiers
var classifiers = {RF: classifier, SVM: svm, CART: cart, GTB: gtb};
print(classifiers)

//added till here for multiple ml 

//applying classifier to image above
var classified = image.classify(classifier); //applieed above classifiers here
print(classified)

// Define color palette for 3 classes as defined
var palette = [
  '#ff6f04',  // builtup - orange
  '#5b77d4',  // Water Bodies - Blue
  '#0b8b0b',  // Forest - Dark Green
  
];
Map.addLayer(classified, {min: 1, max: 3, palette: palette}, 'LULC Map 2019');


//Performing train-test split with (0.7:0.3)
// Split data: 70% train, 30% validate
var withRandom = trainingData.randomColumn('random');
var trainSet = withRandom.filter(ee.Filter.lt('random', 0.7));
var testSet  = withRandom.filter(ee.Filter.gte('random', 0.7));

//trying to see with different classifiers
// ============================================
// STEP 1: Create train/test pixel samples (not polygon split)
// ============================================
var withRandom = training.randomColumn('random');
var trainSplit = withRandom.filter(ee.Filter.lt('random', 0.7));
var testSplit  = withRandom.filter(ee.Filter.gte('random', 0.7));

print('Train size:', trainSplit.size());
print('Test size:', testSplit.size());

// ============================================
// STEP 2: Re-train all 4 classifiers on trainSplit
// ============================================
var rf_val = ee.Classifier.smileRandomForest(100).train({
  features: trainSplit,
  classProperty: 'class',
  inputProperties: image.bandNames()
});

var svm_val = ee.Classifier.libsvm({
  kernelType: 'RBF', gamma: 0.5, cost: 10
}).train({
  features: trainSplit,
  classProperty: 'class',
  inputProperties: image.bandNames()
});

var cart_val = ee.Classifier.smileCart().train({
  features: trainSplit,
  classProperty: 'class',
  inputProperties: image.bandNames()
});

var gtb_val = ee.Classifier.smileGradientTreeBoost(50).train({
  features: trainSplit,
  classProperty: 'class',
  inputProperties: image.bandNames()
});

// ============================================
// STEP 3: Apply each classifier to test split
// ============================================
var test_rf   = testSplit.classify(rf_val);
var test_svm  = testSplit.classify(svm_val);
var test_cart = testSplit.classify(cart_val);
var test_gtb  = testSplit.classify(gtb_val);

// ============================================
// STEP 4: Confusion Matrix for each classifier
// ============================================

// --- RANDOM FOREST ---
var cm_rf = test_rf.errorMatrix('class', 'classification');
print('=== RANDOM FOREST ===');
print('Confusion Matrix:', cm_rf);
print('Overall Accuracy:', cm_rf.accuracy());
print('Kappa Coefficient:', cm_rf.kappa());
print('Producers Accuracy:', cm_rf.producersAccuracy());
print('Consumers Accuracy:', cm_rf.consumersAccuracy());

// --- SVM ---
var cm_svm = test_svm.errorMatrix('class', 'classification');
print('=== SVM ===');
print('Confusion Matrix:', cm_svm);
print('Overall Accuracy:', cm_svm.accuracy());
print('Kappa Coefficient:', cm_svm.kappa());
print('Producers Accuracy:', cm_svm.producersAccuracy());
print('Consumers Accuracy:', cm_svm.consumersAccuracy());

// --- CART ---
var cm_cart = test_cart.errorMatrix('class', 'classification');
print('=== CART ===');
print('Confusion Matrix:', cm_cart);
print('Overall Accuracy:', cm_cart.accuracy());
print('Kappa Coefficient:', cm_cart.kappa());
print('Producers Accuracy:', cm_cart.producersAccuracy());
print('Consumers Accuracy:', cm_cart.consumersAccuracy());

// --- GRADIENT TREE BOOST ---
var cm_gtb = test_gtb.errorMatrix('class', 'classification');
print('=== GRADIENT TREE BOOST ===');
print('Confusion Matrix:', cm_gtb);
print('Overall Accuracy:', cm_gtb.accuracy());
print('Kappa Coefficient:', cm_gtb.kappa());
print('Producers Accuracy:', cm_gtb.producersAccuracy());
print('Consumers Accuracy:', cm_gtb.consumersAccuracy());

//adding comparison chart to above
// ============================================
// STEP 5: Side-by-side Summary Comparison
// ============================================
var summary = ee.Dictionary({
  'RF_Accuracy':   cm_rf.accuracy(),
  'SVM_Accuracy':  cm_svm.accuracy(),
  'CART_Accuracy': cm_cart.accuracy(),
  'GTB_Accuracy':  cm_gtb.accuracy(),
  'RF_Kappa':      cm_rf.kappa(),
  'SVM_Kappa':     cm_svm.kappa(),
  'CART_Kappa':    cm_cart.kappa(),
  'GTB_Kappa':     cm_gtb.kappa()
});

print('========================================');
print('CLASSIFIER COMPARISON SUMMARY:', summary);
print('========================================');

//visualizing classification maps
// ============================================
// STEP 6: Map output for each classifier (2019)
// ============================================
var palette = ['#ff6f04', '#5b77d4', '#0b8b0b'];
var visClass = {min: 1, max: 3, palette: palette};

var classified_RF   = image.classify(rf_val);
var classified_SVM  = image.classify(svm_val);
var classified_CART = image.classify(cart_val);
var classified_GTB  = image.classify(gtb_val);

Map.addLayer(classified_RF,   visClass, 'RF Classification 2019');
Map.addLayer(classified_SVM,  visClass, 'SVM Classification 2019', false);
Map.addLayer(classified_CART, visClass, 'CART Classification 2019', false);
Map.addLayer(classified_GTB,  visClass, 'GTB Classification 2019', false);

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
//adding new code
// Classify all years using the trained classifier
var classified_2019 = getClassified('2019');
var classified_2020 = getClassified('2020');
var classified_2021 = getClassified('2021');
var classified_2022 = getClassified('2022');
var classified_2023 = getClassified('2023');
var classified_2024 = getClassified('2024');
var classified_2025 = getClassified('2025');

var palette = ['#ff6f04', '#5b77d4', '#0b8b0b'];

// Add all years to map (toggle on/off in Layers panel)
Map.addLayer(classified_2019, {min:1, max:3, palette: palette}, 'LULC 2019', false);
Map.addLayer(classified_2020, {min:1, max:3, palette: palette}, 'LULC 2020', false);
Map.addLayer(classified_2021, {min:1, max:3, palette: palette}, 'LULC 2021', false);
Map.addLayer(classified_2022, {min:1, max:3, palette: palette}, 'LULC 2022', false);
Map.addLayer(classified_2023, {min:1, max:3, palette: palette}, 'LULC 2023', false);
Map.addLayer(classified_2024, {min:1, max:3, palette: palette}, 'LULC 2024', false);
Map.addLayer(classified_2025, {min:1, max:3, palette: palette}, 'LULC 2025', false);

// ============================================
// URBAN CHANGE FROM: 2019 vs 2025
// ============================================

// Extract builtup mask per year (class 1 = builtup)
var urban_2019 = classified_2019.eq(1);
var urban_2025 = classified_2025.eq(1);

// Urban GAIN: was NOT builtup in 2019, IS builtup in 2025
var urban_gain = urban_2019.eq(0).and(urban_2025.eq(1)).selfMask();

// Urban LOSS: WAS builtup in 2019, NOT builtup in 2025
var urban_loss = urban_2019.eq(1).and(urban_2025.eq(0)).selfMask();

// Urban STABLE: builtup in BOTH years
var urban_stable = urban_2019.eq(1).and(urban_2025.eq(1)).selfMask();

// Showing urban changes as stable, loss and gain in map
Map.addLayer(urban_stable, {palette: ['FFA500']}, 'Urban Stable 2019-2025');
Map.addLayer(urban_loss,   {palette: ['0000FF']}, 'Urban Loss 2019-2025');
Map.addLayer(urban_gain,   {palette: ['FF0000']}, 'Urban Gain 2019-2025');

Map.addLayer()

// ============================================
// URBAN AREA STATISTICS
// ============================================
var years = ['2019','2020','2021','2022','2023','2024','2025'];
var classifiedList = [
  classified_2019, classified_2020, classified_2021,
  classified_2022, classified_2023, classified_2024, classified_2025
];

for (var i = 0; i < years.length; i++) {
  var urbanMask = classifiedList[i].eq(1).multiply(ee.Image.pixelArea());
  var area = urbanMask.reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: studyArea,
    scale: 10,
    maxPixels: 1e13
  });
  var km2 = ee.Number(area.get('classification')).divide(1e6);
  print('Builtup Area km² — ' + years[i] + ':', km2);
}


