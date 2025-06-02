import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTruck } from "@fortawesome/free-solid-svg-icons";
import React from "react";
import { createRoot } from "react-dom/client";

type TruckIconMarkerProps = {
  color?: string;
  size?: number; // e.g. 40 for 40px
};

const TruckIconMarker = ({ color = "#0000FF", size = 40 }: TruckIconMarkerProps) => {
  const container = document.createElement("div");
  container.style.width = `${size}px`;
  container.style.height = `${size}px`;
  container.style.display = "flex";
  container.style.alignItems = "center";
  container.style.justifyContent = "center";
  container.style.color = color;

  const root = createRoot(container);
  root.render(<FontAwesomeIcon icon={faTruck} size="2x" />);

  return container;
};

export default TruckIconMarker;
