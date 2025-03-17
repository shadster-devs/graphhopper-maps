import { FaPlane, FaBus, FaTaxi } from "react-icons/fa";
import { FaTrainSubway } from "react-icons/fa6";

import { TRANSPORT_MODE_COLORS } from "./TransportModes";

const iconStyle = { size: 15, strokeWidth: 25, stroke: "black" }; // Common style


export const FlightIcon = () => <FaPlane size={15} color={TRANSPORT_MODE_COLORS.flight.selected} style={iconStyle} />;
export const TrainIcon = () => <FaTrainSubway size={15} color={TRANSPORT_MODE_COLORS.train.selected} style={iconStyle} />;
export const BusIcon = () => <FaBus size={15} color={TRANSPORT_MODE_COLORS.bus.selected} style={iconStyle} />;
export const CabIcon = () => <FaTaxi size={15} color={TRANSPORT_MODE_COLORS.cab.selected} style={iconStyle} />;


// Helper function to get the appropriate icon for a transport mode
export const getTransportIcon = (mode: string): React.ReactNode => {
  switch (mode) {
    case 'flight':
      return <FlightIcon />;
    case 'train':
      return <TrainIcon />;
    case 'bus':
      return <BusIcon />;
    case 'cab':
      return <CabIcon />;
    default:
      return <CabIcon />;
  }
}; 