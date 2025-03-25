import { useEffect, useContext } from 'react';
import { Map } from 'ol';
import { SegmentedPath } from '@/api/sarathi';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { fromLonLat } from 'ol/proj';
import { Icon, Style } from 'ol/style';
import { getTransportIcon } from '@/constants/TransportIcons';
import { renderToString } from 'react-dom/server';
import { SettingsContext } from '@/contexts/SettingsContext';
import { PathDisplayMode } from '@/stores/SettingsStore';

// Layer key for static icons
const staticIconsLayerKey = 'staticIconsLayer';

/**
 * Creates a style for a transport mode icon
 * @param iconSvg The SVG string for the icon
 * @param rotation Rotation angle in radians (for flights icon)
 * @returns A style object for the icon
 */
function createStaticIconStyle(iconSvg: string, rotation: number = 0): Style {
  return new Style({
    image: new Icon({
      src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(iconSvg)}`,
      scale: 1.5, // Changed from 2.5 to make icons significantly smaller
      rotation: rotation, // Apply rotation for flights icon
    }),
  });
}

/**
 * Calculate the angle between two points in radians
 * Returns angle where 0 = east, PI/2 = north, PI = west, 3PI/2 = south
 */
const calculateAngle = (startPoint: number[], endPoint: number[]): number => {
  // Calculate angle in radians
  const dx = endPoint[0] - startPoint[0];
  const dy = endPoint[1] - startPoint[1];
  
  // For OpenLayers rotation, the angle must be given in radians counterclockwise
  // But we need to adjust because the icon is pointing east by default
  // The negative sign is because our map coordinates have y increasing downwards
  return Math.atan2(-dy, dx);
};

/**
 * Custom hook to add static icons in the middle of each path segment for status mode
 */
export default function useStaticTransportIcons(map: Map, selectedPath: SegmentedPath) {
  // Get settings from context
  const settings = useContext(SettingsContext);
  
  useEffect(() => {
    // Clean up any existing static icons
    cleanupStaticIcons();
    
    // Only create static icons if we have segments and we're in status mode
    if (settings.pathDisplayMode !== PathDisplayMode.Static || 
        !selectedPath.segments || 
        selectedPath.segments.length === 0) {
      return;
    }
    
    // Create a new vector layer for the static icons
    const iconSource = new VectorSource();
    const iconLayer = new VectorLayer({
      source: iconSource,
      zIndex: 10, // Keep on top
    });
    
    iconLayer.set(staticIconsLayerKey, true);
    map.addLayer(iconLayer);
    
    // Add an icon for each segment in the middle of the path
    selectedPath.segments.forEach((segment) => {
      // Determine coordinates for the icon from segment points
      let coordinates: number[][] = [];
      
      if (segment.points && segment.points.length > 0) {
        // Use existing points if available
        coordinates = segment.points.map(coord => fromLonLat(coord));
      }
      
      // Only proceed if we have coordinates
      if (coordinates.length > 0) {
        // Normalize the mode from Sarathi API format
        const normalizedMode = segment.mode?.toLowerCase() || '';
        let mappedMode = normalizedMode;
        
        // Map Sarathi API enum values to our local values
        if (normalizedMode === 'flights') mappedMode = 'flights';
        if (normalizedMode === 'rails') mappedMode = 'train';
        
        // Render the icon to string using the mapped mode
        const iconSvg = renderToString(getTransportIcon(mappedMode));
        
        // Put the icon in the middle of the path
        const midIndex = Math.floor(coordinates.length / 2);
        let midPoint: number[] | undefined;
        
        if (coordinates.length === 1) {
          // If there's only one point, use it
          midPoint = coordinates[0];
        } else if (coordinates.length >= 2) {
          // If there are multiple points, use the middle one, or calculate a midpoint
          if (coordinates.length % 2 === 1) {
            // Odd number of points, use the middle one
            midPoint = coordinates[midIndex];
          } else {
            // Even number of points, calculate midpoint between the two middle ones
            const prev = coordinates[midIndex - 1];
            const next = coordinates[midIndex];
            midPoint = [(prev[0] + next[0]) / 2, (prev[1] + next[1]) / 2];
          }
        }
        
        // Only create feature if we have a valid midpoint
        if (midPoint) {
          // Create a feature for the icon
          const iconFeature = new Feature({
            geometry: new Point(midPoint),
          });
          
          // Calculate rotation for flights segments
          let rotation = 0;
          if (mappedMode === 'flights' && coordinates.length >= 2) {
            // For flights, get the angle between start and end points
            const startPoint = coordinates[0];
            const endPoint = coordinates[coordinates.length - 1];
            rotation = calculateAngle(startPoint, endPoint);
          }
          
          // Set the icon style with appropriate rotation
          iconFeature.setStyle(createStaticIconStyle(iconSvg, rotation));
          
          // Add the feature to the layer
          iconSource.addFeature(iconFeature);
        }
      }
    });
    
    // Cleanup function
    return () => {
      cleanupStaticIcons();
    };
  }, [map, selectedPath, settings.pathDisplayMode]);
  
  // Function to clean up static icons
  const cleanupStaticIcons = () => {
    map.getLayers()
      .getArray()
      .filter(l => l.get(staticIconsLayerKey))
      .forEach(l => map.removeLayer(l));
  };
  
  return null;
} 