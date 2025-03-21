import { FaPlane, FaBus, FaTaxi } from "react-icons/fa";
import { FaTrainSubway } from "react-icons/fa6";

import { TRANSPORT_MODE_COLORS } from "./TransportModes";

const iconStyle = { size: 15, strokeWidth: 25, stroke: "black" }; // Common style


export const FlightIcon = () => <FaPlane size={15} color={TRANSPORT_MODE_COLORS.FLIGHTS.icon} style={iconStyle} />;
export const TrainIcon = () => <FaTrainSubway size={15} color={TRANSPORT_MODE_COLORS.RAILS.icon} style={iconStyle} />;
export const BusIcon = () => <FaBus size={15} color={TRANSPORT_MODE_COLORS.BUS.icon} style={iconStyle} />;
export const CabIcon = () => <FaTaxi size={15} color={TRANSPORT_MODE_COLORS.CAB.icon} style={iconStyle} />;


// Helper function to get the appropriate icon for a transport mode
export const getTransportIcon = (mode: string): React.ReactNode => {
  // Handle both uppercase and lowercase mode values
  const normalizedMode = mode?.toUpperCase();
  
  switch (normalizedMode) {
    case 'FLIGHTS':
    case 'FLIGHT':
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