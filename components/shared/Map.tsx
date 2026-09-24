// ============================================
// Google Maps Component
// Save as: components/shared/Map.tsx
// ============================================

'use client';

import { useEffect, useRef } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import type { MapProps, MapMarker } from '@/lib/types';

const DEFAULT_ZOOM = 15;
const DEFAULT_CENTER = { lat: 12.9716, lng: 77.5946 }; // Bangalore

/**
 * Google Maps Component
 * Displays interactive map with markers and click handling
 *
 * Props:
 * - center: Map center coordinates (default: Bangalore)
 * - zoom: Zoom level (default: 15)
 * - markers: Array of markers to display
 * - onMapClick: Callback when map is clicked
 * - onMarkerClick: Callback when marker is clicked
 * - height: Map container height (default: '400px')
 */
export function Map({
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  markers = [],
  onMapClick,
  onMarkerClick,
  height = '400px',
}: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<globalThis.Map<string, google.maps.Marker>>(new globalThis.Map());

  // Initialize map
  useEffect(() => {
    const initMap = async () => {
      if (!mapContainer.current) return;

      // Load Google Maps API
      const loader = new Loader({
        apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || '',
        version: 'weekly',
        libraries: ['places'],
      });

      try {
        const { Map: GoogleMap } = await loader.importLibrary('maps');

        // Create map instance
        map.current = new GoogleMap(mapContainer.current, {
          center,
          zoom,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
        });

        // Handle map clicks
        if (onMapClick) {
          map.current.addListener('click', (event: google.maps.MapMouseEvent) => {
            if (event.latLng) {
              onMapClick(event.latLng.lat(), event.latLng.lng());
            }
          });
        }
      } catch (error) {
        console.error('Failed to load Google Maps:', error);
      }
    };

    initMap();
  }, []);

  // Add/update markers
  useEffect(() => {
    if (!map.current) return;

    // Clear existing markers not in new list
    const newMarkerIds = new Set(markers.map((m) => m.id));
    markersRef.current.forEach((marker, id) => {
      if (!newMarkerIds.has(id)) {
        marker.setMap(null);
        markersRef.current.delete(id);
      }
    });

    // Add new markers
    markers.forEach((marker) => {
      if (!markersRef.current.has(marker.id)) {
        const markerColor = getMarkerColor(marker.color || 'red');
        const gMarker = new google.maps.Marker({
          position: { lat: marker.lat, lng: marker.lng },
          map: map.current,
          title: marker.title,
          label: marker.label,
          icon: createMarkerIcon(markerColor),
        });

        // Handle marker click
        if (onMarkerClick) {
          gMarker.addListener('click', () => {
            onMarkerClick(marker.id);
          });
        }

        // Add info window
        if (marker.title) {
          const infoWindow = new google.maps.InfoWindow({
            content: marker.title,
          });

          gMarker.addListener('click', () => {
            // Close all other info windows
            markersRef.current.forEach((m, id) => {
              if (id !== marker.id && (m as any).infoWindow) {
                (m as any).infoWindow.close();
              }
            });
            infoWindow.open(map.current, gMarker);
          });

          (gMarker as any).infoWindow = infoWindow;
        }

        markersRef.current.set(marker.id, gMarker);
      }
    });
  }, [markers, onMarkerClick]);

  // Update center
  useEffect(() => {
    if (map.current && center) {
      map.current.panTo(center);
      map.current.setZoom(zoom);
    }
  }, [center, zoom]);

  return (
    <div
      ref={mapContainer}
      className="w-full rounded-lg shadow-md overflow-hidden border border-vayroBorder"
      style={{ height }}
    />
  );
}

/**
 * Get color code for marker
 */
function getMarkerColor(color: string): string {
  const colors: Record<string, string> = {
    red: 'FF0000',
    blue: '0000FF',
    green: '00FF00',
    yellow: 'FFFF00',
  };
  return colors[color] || 'FF0000';
}

/**
 * Create SVG marker icon
 */
function createMarkerIcon(color: string): google.maps.Symbol {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    fillColor: `#${color}`,
    fillOpacity: 0.8,
    scale: 8,
    strokeColor: 'white',
    strokeWeight: 2,
  };
}
