"use client";

type Props = {
  query: string;
  placeId?: string;
  title?: string;
  className?: string;
};

export function GoogleMapFrame({ query, placeId, title = "Map preview", className }: Props) {
  const params = new URLSearchParams();

  if (query) {
    params.set("query", query);
  }

  if (placeId) {
    params.set("placeId", placeId);
  }

  const src = `/api/maps/embed?${params.toString()}`;

  return (
    <div className={className}>
      <iframe
        title={title}
        src={src}
        loading="lazy"
        className="h-full w-full rounded-[inherit] border-0"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />
    </div>
  );
}
