import { FaPlane, FaBus, FaTaxi } from "react-icons/fa";
import { FaTrainSubway } from "react-icons/fa6";

import { TRANSPORT_MODE_COLORS } from "./TransportModes";

// Removed stroke to make icons cleaner and more modern
export const FlightIcon = () => <FaPlane size={18} color={TRANSPORT_MODE_COLORS.FLIGHTS.icon} style={{ stroke: "black", strokeWidth: 25 }} /> ;
export const TrainIcon = () => <FaTrainSubway size={18} color={TRANSPORT_MODE_COLORS.RAILS.icon} style={{ stroke: "black", strokeWidth: 25 }} />;
export const BusIcon = () => <FaBus size={18} color={TRANSPORT_MODE_COLORS.BUS.icon} style={{ stroke: "black", strokeWidth: 25 }}   />;
export const CabIcon = () => <FaTaxi size={18} color={TRANSPORT_MODE_COLORS.CAB.icon} style={{ stroke: "black", strokeWidth: 25 }} />;


// Helper function to get the appropriate icon for a transport mode
export const getTransportIcon = (mode: string): React.ReactNode => {
  // Handle both uppercase and lowercase mode values
  const normalizedMode = mode?.toUpperCase();
  
  switch (normalizedMode) {
    case 'FLIGHTS':
    case 'FLIGHTS':
      return <FlightIcon />;
    case 'RAILS':
    case 'RAIL':
    case 'TRAIN':
      return <TrainIcon />;
    case 'BUS':
      return <BusIcon />;
    case 'CAB':
    case 'TAXI':
      return <CabIcon />;
    default:
      console.log(`Unknown transport mode: ${mode}`);
      return <CabIcon />; // Default fallback
  }
}; 