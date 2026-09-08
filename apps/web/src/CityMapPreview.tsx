import React from "react";
import { createRoot } from "react-dom/client";
import TripMap, { MAPBOX_TOKEN, type MapRoute } from "./TripMap";
import "./styles.css";

const routes: MapRoute[] = [
  { day: 1, title: "Au fil de la Seine", points: [
    { name: "Place du Trocadéro", lat: 48.862, lon: 2.288, kind: "visit" },
    { name: "Tour Eiffel", lat: 48.8584, lon: 2.2945, kind: "visit" },
    { name: "Champ-de-Mars", lat: 48.8556, lon: 2.2986, kind: "visit" }
  ] },
  { day: 2, title: "Arts et jardins", points: [
    { name: "Musée d’Orsay", lat: 48.86, lon: 2.3266, kind: "ticket" },
    { name: "Jardin des Tuileries", lat: 48.8635, lon: 2.3275, kind: "visit" },
    { name: "Musée du Louvre", lat: 48.8606, lon: 2.3376, kind: "ticket" }
  ] }
];
createRoot(document.getElementById("root")!).render(<React.StrictMode><main style={{ maxWidth: 1250, margin: "32px auto", padding: 16 }}><p>Paris · Aperçu avec un itinéraire de démonstration</p>{MAPBOX_TOKEN ? <TripMap routes={routes} /> : <p>La clé publique Mapbox doit être configurée pour afficher cet aperçu.</p>}</main></React.StrictMode>);
