/**
 * Webpack will replace this file with config-local.js if it exists
 */
const config = {
    // We're using Sarathi APIs directly for routing and search
    // Only keeping geocodingApi for now in case reverseGeocode still needs it
    geocodingApi: '', // Disabled since we're using Sarathi API
    // the tile layer used by default, see MapOptionsStore.ts for all options
    defaultTiles: 'OpenStreetMap',
    // various api keys used for the GH backend and the different tile providers
    keys: {
        graphhopper: 'bfb9d728-3732-4542-9e92-f638ac1c9f3a',
        maptiler: 'missing_api_key',
        omniscale: 'missing_api_key',
        thunderforest: 'missing_api_key',
        kurviger: 'missing_api_key',
    },
    // disable routing graph layer since we're using Sarathi routing
    routingGraphLayerAllowed: false,
    // parameters used for the routing request generation
    request: {
        details: [
            'road_class',
            'road_environment',
            //'road_access',
            //'surface',
            'max_speed',
            'average_speed',
            //'osm_way_id'
            //'toll',
            //'track_type',
            //'country',
        ],
    },

    // Use 'profiles' to define which profiles are visible and how. Useful if the /info endpoint contains too many or too "ugly" profile
    // names or in the wrong order. The key of each profile will be used as name and the given fields will overwrite the fields of the
    // default routing request. The following example is tuned towards the GraphHopper Directions API. If you have an own server you might want to adapt it.
    //
    // profiles: {
    //    car:{}, small_truck:{}, truck:{}, scooter:{},
    //    foot:{ details: ['foot_network', 'access_conditional', 'foot_conditional', 'hike_rating'] }, hike:{ details: ['foot_network', 'access_conditional', 'foot_conditional', 'hike_rating' ] },
    //    bike:{ details: ['get_off_bike', 'bike_network', 'access_conditional', 'bike_conditional', 'mtb_rating' ] }, mtb:{ details: ['get_off_bike', 'bike_network', 'access_conditional', 'bike_conditional', 'mtb_rating'] }, racingbike:{ details: ['get_off_bike', 'bike_network', 'access_conditional', 'bike_conditional', 'mtb_rating'] },
    // }
    //
    // E.g. the 'bike' entry will add a "bike" profile for which we send a request with the specified 'details' parameter. You can even change the profile itself when you specify
    // bike: { profile: 'raw_bike', ... }
}

// this is needed for jest (with our current setup at least)
if (module) module.exports = config
