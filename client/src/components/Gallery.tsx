import { memo, useMemo } from "react";
import { FixedSizeGrid as Grid } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import { MediaItem } from "@/lib/types";

interface GalleryProps {
  mediaItems: MediaItem[];
  isLoading: boolean;
  isConnected: boolean;
  onSelectMedia: (media: MediaItem) => void;
  onRefresh: () => void;
}

function EmptyState() {
  return (
    <div className="h-full flex flex-col items-center justify-center p-8">
      <div className="text-6xl text-ios-gray mb-4">
        <i className="fas fa-cloud-upload-alt"></i>
      </div>
      <h3 className="text-xl font-medium text-ios-gray mb-2">No Photos or Videos</h3>
      <p className="text-center text-ios-gray">Capture moments with the camera tab and they'll appear here!</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="h-full flex flex-col items-center justify-center p-8">
      <div className="text-6xl text-ios-blue mb-4">
        <i className="fas fa-spinner fa-spin"></i>
      </div>
      <h3 className="text-xl font-medium mb-2">Loading media...</h3>
      <p className="text-center text-ios-gray">Fetching your photos and videos from S3</p>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="h-full flex flex-col items-center justify-center p-8">
      <div className="text-6xl text-ios-red mb-4">
        <i className="fas fa-exclamation-circle"></i>
      </div>
      <h3 className="text-xl font-medium mb-2">Connection Error</h3>
      <p className="text-center text-ios-gray mb-4">Unable to connect to your S3 bucket</p>
      <button
        className="bg-ios-blue text-white px-4 py-2 rounded-md"
        onClick={onRetry}
      >
        Retry Connection
      </button>
    </div>
  );
}

export default function Gallery({ mediaItems, isLoading, isConnected, onSelectMedia, onRefresh }: GalleryProps) {
  return (
    <div className="h-full flex flex-col">
      <header className="px-4 py-3 bg-white dark:bg-ios-darkgray border-b border-gray-200 dark:border-gray-800">
        <h1 className="text-lg font-semibold text-center">Photos & Videos</h1>
      </header>

      <div className="flex-grow overflow-hidden">
        {isLoading ? (
          <LoadingState />
        ) : !isConnected ? (
          <ErrorState onRetry={onRefresh} />
        ) : mediaItems.length === 0 ? (
          <EmptyState />
        ) : (
          <MediaGrid items={mediaItems} onSelectMedia={onSelectMedia} />
        )}
      </div>
    </div>
  );
}

interface CellData {
  items: MediaItem[];
  onSelectMedia: (media: MediaItem) => void;
  columnCount: number;
}

const MediaCell = memo(function MediaCell({
  columnIndex,
  rowIndex,
  style,
  data,
}: {
  columnIndex: number;
  rowIndex: number;
  style: React.CSSProperties;
  data: CellData;
}) {
  const index = rowIndex * data.columnCount + columnIndex;
  if (index >= data.items.length) return null;

  const item = data.items[index];

  return (
    <div style={style} className="p-0.5">
      <button
        type="button"
        className="relative block h-full w-full overflow-hidden bg-gray-200 dark:bg-gray-800"
        onClick={() => data.onSelectMedia(item)}
      >
        <img
          src={item.thumbnail || item.url}
          alt=""
          loading="eager"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
        {item.type.startsWith("video/") && (
          <div className="absolute bottom-1 right-1">
            <i className="fas fa-play text-white text-xs w-4 h-4 flex items-center justify-center bg-black/50 rounded-full"></i>
          </div>
        )}
        <div className="opacity-0 hover:opacity-100 absolute inset-0 bg-black/20 flex items-center justify-center transition-opacity">
          <span className="text-white">
            <i className="fas fa-expand text-lg"></i>
          </span>
        </div>
      </button>
    </div>
  );
});

function MediaGrid({ items, onSelectMedia }: { items: MediaItem[], onSelectMedia: (media: MediaItem) => void }) {
  const columnCount = 3;
  const cellSize = 120;
  const cellData = useMemo<CellData>(() => ({
    items,
    onSelectMedia,
    columnCount,
  }), [items, onSelectMedia]);

  return (
    <AutoSizer>
      {({ height, width }) => {
        const columnWidth = width / columnCount;
        const rowCount = Math.ceil(items.length / columnCount);
        return (
          <Grid
            columnCount={columnCount}
            columnWidth={columnWidth}
            height={height}
            rowCount={rowCount}
            rowHeight={cellSize}
            width={width}
            itemData={cellData}
            overscanRowCount={6}
          >
            {MediaCell}
          </Grid>
        );
      }}
    </AutoSizer>
  );
}
