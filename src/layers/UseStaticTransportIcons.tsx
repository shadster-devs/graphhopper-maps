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
 * @param rotation Rotation angle in radians (for flight icon)
 * @returns A style object for the icon
 */
function createStaticIconStyle(iconSvg: string, rotation: number = 0): Style {
  return new Style({
    image: new Icon({
      src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(iconSvg)}`,
      scale: 1.5, // Changed from 2.5 to make icons significantly smaller
      rotation: rotation, // Apply rotation for flight icon
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
      // Render the icon to string
      const iconSvg = renderToString(getTransportIcon(segment.mode));
      
      // Get the coordinates of the segment
      const coordinates = segment.points.coordinates.map(coord => fromLonLat(coord));
      
      // Put the icon in the middle of the path
      const midIndex = Math.floor(coordinates.length / 2);
      let midPoint;
      
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
      } else {
        // No coordinates, skip this segment
        return;
      }
      
      // Create a feature with a point geometry at the midpoint
      const feature = new Feature({
        geometry: new Point(midPoint),
        mode: segment.mode,
      });
      
      // Calculate rotation for flight icons
      let rotation = 0;
      if (segment.mode === 'flight' && coordinates.length >= 2) {
        // For flight mode, calculate angle between first and last point
        rotation = calculateAngle(coordinates[0], coordinates[coordinates.length - 1]);
      }
      
      // Set the icon style
      feature.setStyle(createStaticIconStyle(iconSvg, rotation));
      
      // Add to the layer
      iconSource.addFeature(feature);
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