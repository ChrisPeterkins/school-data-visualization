import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

interface SchoolMapProps {
  latitude: number;
  longitude: number;
  name: string;
}

/** Small locator map. A circle marker avoids Leaflet's bundled icon images. */
export default function SchoolMap({ latitude, longitude, name }: SchoolMapProps) {
  return (
    <div className="h-40 sm:h-full min-h-[10rem] rounded-lg overflow-hidden border border-stone-200">
      <MapContainer
        center={[latitude, longitude]}
        zoom={12}
        scrollWheelZoom={false}
        dragging={false}
        zoomControl={false}
        attributionControl={true}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <CircleMarker center={[latitude, longitude]} radius={8} pathOptions={{ color: '#1b2a4a', fillColor: '#d4aa3c', fillOpacity: 0.95, weight: 2 }}>
          <Tooltip direction="top" offset={[0, -8]}>{name}</Tooltip>
        </CircleMarker>
      </MapContainer>
    </div>
  );
}
