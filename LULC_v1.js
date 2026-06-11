var collection2015 = ee.ImageCollection("COPERNICUS/S2_HARMONIZED")
                .filterBounds(studyArea)
                .filterDate(START_2015, END_2015);

// 2. Map over the collection to select bands
var selectedCollection2015 = collection2015.map(function(image) {
  return image.select(['B2','B3','B4','B8','B11','B12','B8A', 'B9', 'B10','QA10' ,'QA20' , 'QA60', 'MSK_CLASSI_OPAQUE', 'MSK_CLASSI_CIRRUS']);
});

print("Images for 2015 Collection:", selectedCollection2015);


var finalMosaic = selectedCollection2015.mosaic(); 

// 4. Calculate your indices using the mosaic image
var ndvi = finalMosaic.normalizedDifference(['B8', 'B4']).rename('NDVI');
var ndwi = finalMosaic.normalizedDifference(['B3', 'B8']).rename('NDWI');
var ndbi = finalMosaic.normalizedDifference(['B11', 'B8']).rename('NDBI');

var image = finalMosaic.addBands([ndvi, ndwi, ndbi]);