"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  ChevronLeft,
  ChevronRight,
  X,
  Grid3X3,
  List,
  RotateCcw,
  Settings,
  Eye,
  Blocks,
  ImageIcon,
  FileText,
  Calendar,
  ArrowUpDown,
} from "lucide-react"

interface WordPressItem {
  id: number
  title?: { rendered: string }
  content?: { rendered: string }
  excerpt?: { rendered: string }
  caption?: { rendered: string }
  description?: { rendered: string }
  date: string
  source_url?: string
  _embedded?: {
    "wp:featuredmedia"?: Array<{ source_url: string }>
  }
}

interface AppSettings {
  loadMore: boolean
  itemsPerPage: number
  sortDescending: boolean
  mainViewMode: "feed" | "grid" | "carousel"
  contentViewMode: "page" | "grid" | "carousel"
}

export default function WordPressFeed() {
  const wpApiBase = ""
  const [settings, setSettings] = useState<AppSettings>({
    loadMore: true,
    itemsPerPage: 5,
    sortDescending: true,
    mainViewMode: "feed",
    contentViewMode: "page",
  })

  const [currentType, setCurrentType] = useState<"posts" | "pages" | "media">("posts")
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [allItems, setAllItems] = useState<WordPressItem[]>([])
  const [currentItem, setCurrentItem] = useState<WordPressItem | null>(null)
  const [showPopover, setShowPopover] = useState(false)
  const [activeSlide, setActiveSlide] = useState(0)
  const [contentBlocks, setContentBlocks] = useState<string[]>([])
  const [showUrlConfig, setShowUrlConfig] = useState(false)
  const [customUrl, setCustomUrl] = useState("")
  const [urlStatus, setUrlStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle")
  const [currentApiBase, setCurrentApiBase] = useState("")

  const endMarkerRef = useRef<HTMLDivElement>(null)

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoading && hasMore && settings.loadMore) {
          loadMoreContent()
        }
      },
      { threshold: 0.1 },
    )

    if (endMarkerRef.current) {
      observer.observe(endMarkerRef.current)
    }

    return () => observer.disconnect()
  }, [isLoading, hasMore, settings.loadMore])

  const loadContent = useCallback(async () => {
    if (isLoading) return

    // Show URL config if no API base is set
    if (!currentApiBase) {
      setShowUrlConfig(true)
      return
    }

    setIsLoading(true)
    try {
      let url = `${currentApiBase}/${currentType}?_embed&per_page=${settings.itemsPerPage}&page=${currentPage}&orderby=date&order=${settings.sortDescending ? "desc" : "asc"}`
      if (currentType === "media") url += "&media_type=image"

      const response = await fetch(url)

      // Check if response is HTML (likely a 404 or error page)
      const contentType = response.headers.get("content-type")
      if (!response.ok || !contentType?.includes("application/json")) {
        throw new Error("WordPress API not found or not accessible")
      }

      const totalPages = Number.parseInt(response.headers.get("X-WP-TotalPages") || "1")
      setHasMore(currentPage < totalPages)

      const newItems = await response.json()
      setAllItems((prev) => [...prev, ...newItems])
      setCurrentPage((prev) => prev + 1)
    } catch (error) {
      console.error("Error fetching content:", error)
      // Show URL config popup on error
      if (currentPage === 1 && allItems.length === 0) {
        setShowUrlConfig(true)
      }
    } finally {
      setIsLoading(false)
    }
  }, [
    currentType,
    currentPage,
    settings.itemsPerPage,
    settings.sortDescending,
    isLoading,
    currentApiBase,
    allItems.length,
  ])

  const loadMoreContent = () => {
    if (!isLoading && hasMore) {
      loadContent()
    }
  }

  const resetAndLoadContent = (type: "posts" | "pages" | "media") => {
    setCurrentType(type)
    setCurrentPage(1)
    setHasMore(true)
    setAllItems([])
    setActiveSlide(0)
  }

  useEffect(() => {
    loadContent()
  }, [currentType])

  const parseContentBlocks = (content: string): string[] => {
    if (!content) return []
    const parser = new DOMParser()
    const doc = parser.parseFromString(content, "text/html")
    return Array.from(doc.body.children).map((el) => el.outerHTML)
  }

  const validateWordPressUrl = async (url: string): Promise<boolean> => {
    if (!url) return false

    try {
      // Clean the URL - remove trailing slash and ensure it doesn't have the API path
      const cleanUrl = url.replace(/\/$/, "").replace(/\/wp-json.*$/, "")
      const testUrl = `${cleanUrl}/wp-json/wp/v2/posts?per_page=1`

      const response = await fetch(testUrl)
      return response.ok
    } catch {
      return false
    }
  }

  const handleUrlChange = async (url: string) => {
    setCustomUrl(url)

    if (!url.trim()) {
      setUrlStatus("idle")
      return
    }

    setUrlStatus("checking")
    const isValid = await validateWordPressUrl(url)
    setUrlStatus(isValid ? "valid" : "invalid")
  }

  const saveCustomUrl = () => {
    if (urlStatus === "valid" && customUrl) {
      const cleanUrl = customUrl.replace(/\/$/, "").replace(/\/wp-json.*$/, "")
      setCurrentApiBase(`${cleanUrl}/wp-json/wp/v2`)
      setShowUrlConfig(false)
      // Reset and reload content with new URL
      setCurrentPage(1)
      setHasMore(true)
      setAllItems([])
      setActiveSlide(0)
    }
  }

  const openPopover = async (item: WordPressItem) => {
    setCurrentItem(item)
    setShowPopover(true)

    try {
      if (currentType === "posts" || currentType === "pages") {
        const response = await fetch(`${wpApiBase}/${currentType}/${item.id}?_embed`)
        if (response.ok) {
          const fullItem = await response.json()
          setCurrentItem(fullItem)
          setContentBlocks(parseContentBlocks(fullItem.content?.rendered || ""))
        }
      }
    } catch (error) {
      console.error("Error loading content:", error)
    }
  }

  const getItemTitle = (item: WordPressItem) => item.title?.rendered || item.caption?.rendered || "Untitled"

  const getItemContent = (item: WordPressItem) => item.excerpt?.rendered || item.description?.rendered || ""

  const getItemImage = (item: WordPressItem) => item.source_url || item._embedded?.["wp:featuredmedia"]?.[0]?.source_url

  const ContentTypeButton = ({
    type,
    icon: Icon,
    label,
    isActive,
  }: {
    type: "posts" | "pages" | "media"
    icon: any
    label: string
    isActive: boolean
  }) => (
    <button
      onClick={() => resetAndLoadContent(type)}
      className={`group relative px-6 py-3 rounded-xl font-medium transition-all duration-300 transform hover:scale-105 ${
        isActive
          ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/25"
          : "bg-white/80 backdrop-blur-sm text-gray-700 hover:bg-white hover:shadow-md border border-gray-200/50"
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon
          className={`w-4 h-4 transition-transform duration-300 ${isActive ? "rotate-12" : "group-hover:rotate-12"}`}
        />
        <span>{label}</span>
      </div>
      {isActive && (
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl blur opacity-30 -z-10 animate-pulse" />
      )}
    </button>
  )

  const ViewModeButton = ({
    mode,
    icon: Icon,
    label,
    isActive,
    onClick,
  }: {
    mode: string
    icon: any
    label: string
    isActive: boolean
    onClick: () => void
  }) => (
    <button
      onClick={onClick}
      className={`group relative px-4 py-2 rounded-lg font-medium transition-all duration-300 transform hover:scale-105 ${
        isActive
          ? "bg-gradient-to-r from-indigo-500 to-blue-600 text-white shadow-lg shadow-indigo-500/25"
          : "bg-white/60 backdrop-blur-sm text-gray-600 hover:bg-white/80 hover:shadow-md border border-gray-200/50"
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon
          className={`w-4 h-4 transition-transform duration-300 ${isActive ? "scale-110" : "group-hover:scale-110"}`}
        />
        <span className="text-sm">{label}</span>
      </div>
    </button>
  )

  const ToggleSwitch = ({
    checked,
    onChange,
    label,
  }: {
    checked: boolean
    onChange: (checked: boolean) => void
    label: string
  }) => (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium text-gray-700">{label}:</span>
      <button
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 transform hover:scale-105 ${
          checked ? "bg-gradient-to-r from-blue-500 to-purple-600 shadow-lg shadow-blue-500/25" : "bg-gray-300"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-all duration-300 shadow-lg ${
            checked ? "translate-x-6 scale-110" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  )

  const LoadingSpinner = () => (
    <div className="flex justify-center py-12">
      <div className="relative">
        <div className="w-12 h-12 border-4 border-blue-200 rounded-full animate-spin border-t-blue-500"></div>
        <div className="absolute inset-0 w-12 h-12 border-4 border-transparent rounded-full animate-ping border-t-blue-300"></div>
      </div>
    </div>
  )

  const FeedView = () => (
    <div className="space-y-6">
      {allItems.map((item, index) => (
        <div
          key={item.id}
          onClick={() => openPopover(item)}
          className="group bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-500 cursor-pointer transform hover:scale-[1.02] hover:-translate-y-1 border border-gray-200/50"
          style={{ animationDelay: `${index * 100}ms` }}
        >
          <div className="flex flex-col lg:flex-row gap-6">
            {getItemImage(item) && (
              <div className="lg:w-1/3 overflow-hidden rounded-xl">
                <img
                  src={getItemImage(item) || "/placeholder.svg"}
                  alt={getItemTitle(item)}
                  className="w-full h-48 lg:h-32 object-cover transition-transform duration-500 group-hover:scale-110"
                />
              </div>
            )}
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-800 mb-2 group-hover:text-blue-600 transition-colors duration-300">
                {getItemTitle(item)}
              </h2>
              <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <span>{new Date(item.date).toLocaleDateString()}</span>
                </div>
                <span className="px-3 py-1 bg-gradient-to-r from-blue-100 to-purple-100 text-blue-700 rounded-full text-xs font-medium">
                  {currentType}
                </span>
              </div>
              <div
                className="text-gray-600 line-clamp-3 prose prose-sm"
                dangerouslySetInnerHTML={{ __html: getItemContent(item) }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  )

  const GridView = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {allItems.map((item, index) => (
        <div
          key={item.id}
          onClick={() => openPopover(item)}
          className="group bg-white/80 backdrop-blur-sm rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500 cursor-pointer transform hover:scale-105 hover:-translate-y-2 border border-gray-200/50"
          style={{ animationDelay: `${index * 50}ms` }}
        >
          {getItemImage(item) && (
            <div className="relative overflow-hidden h-48">
              <img
                src={getItemImage(item) || "/placeholder.svg"}
                alt={getItemTitle(item)}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
          )}
          <div className="p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-2 group-hover:text-blue-600 transition-colors duration-300 line-clamp-2">
              {getItemTitle(item)}
            </h3>
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
              <Calendar className="w-3 h-3" />
              <span>{new Date(item.date).toLocaleDateString()}</span>
            </div>
            <div
              className="text-gray-600 text-sm line-clamp-3 prose prose-sm"
              dangerouslySetInnerHTML={{ __html: getItemContent(item) }}
            />
          </div>
        </div>
      ))}
    </div>
  )

  const CarouselView = () => (
    <div className="relative bg-white/80 backdrop-blur-sm rounded-2xl overflow-hidden shadow-2xl border border-gray-200/50">
      <div
        className="flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${activeSlide * 100}%)` }}
      >
        {allItems.map((item, index) => (
          <div key={item.id} className="w-full flex-shrink-0 p-8">
            <div className="max-w-4xl mx-auto text-center">
              <h3 className="text-3xl font-bold text-gray-800 mb-4">{getItemTitle(item)}</h3>
              <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-6">
                <Calendar className="w-4 h-4" />
                <span>{new Date(item.date).toLocaleDateString()}</span>
              </div>
              {getItemImage(item) && (
                <div className="mb-6 overflow-hidden rounded-2xl shadow-lg">
                  <img
                    src={getItemImage(item) || "/placeholder.svg"}
                    alt={getItemTitle(item)}
                    className="w-full max-h-96 object-contain mx-auto"
                  />
                </div>
              )}
              <div
                className="prose prose-lg mx-auto text-gray-600"
                dangerouslySetInnerHTML={{ __html: getItemContent(item) }}
              />
            </div>
          </div>
        ))}
      </div>

      {allItems.length > 1 && (
        <>
          <button
            onClick={() => setActiveSlide((prev) => (prev === 0 ? allItems.length - 1 : prev - 1))}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 backdrop-blur-sm p-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-110 border border-gray-200/50"
          >
            <ChevronLeft className="w-6 h-6 text-gray-700" />
          </button>
          <button
            onClick={() => setActiveSlide((prev) => (prev === allItems.length - 1 ? 0 : prev + 1))}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 backdrop-blur-sm p-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-110 border border-gray-200/50"
          >
            <ChevronRight className="w-6 h-6 text-gray-700" />
          </button>

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
            {allItems.map((_, index) => (
              <button
                key={index}
                onClick={() => setActiveSlide(index)}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  index === activeSlide
                    ? "bg-blue-500 scale-125 shadow-lg shadow-blue-500/50"
                    : "bg-gray-300 hover:bg-gray-400"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-4 mb-4">
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              WordPress Content Feed
            </h1>
            <button
              onClick={() => setShowUrlConfig(true)}
              className="p-2 bg-white/80 backdrop-blur-sm rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-110 border border-gray-200/50"
              title="Configure WordPress URL"
            >
              <Settings className="w-5 h-5 text-gray-600" />
            </button>
          </div>
          <p className="text-gray-600 text-lg">Discover and explore content in style</p>
        </div>

        {/* Controls */}
        <div className="bg-white/60 backdrop-blur-lg rounded-2xl p-6 mb-8 shadow-xl border border-gray-200/50">
          <div className="flex flex-wrap items-center justify-between gap-6">
            {/* Content Type */}
            <div className="flex gap-3">
              <ContentTypeButton type="posts" icon={FileText} label="Posts" isActive={currentType === "posts"} />
              <ContentTypeButton type="pages" icon={Eye} label="Pages" isActive={currentType === "pages"} />
              <ContentTypeButton type="media" icon={ImageIcon} label="Media" isActive={currentType === "media"} />
            </div>

            {/* View Mode */}
            <div className="flex gap-2">
              <ViewModeButton
                mode="feed"
                icon={List}
                label="List"
                isActive={settings.mainViewMode === "feed"}
                onClick={() => setSettings((prev) => ({ ...prev, mainViewMode: "feed" }))}
              />
              <ViewModeButton
                mode="grid"
                icon={Grid3X3}
                label="Grid"
                isActive={settings.mainViewMode === "grid"}
                onClick={() => setSettings((prev) => ({ ...prev, mainViewMode: "grid" }))}
              />
              <ViewModeButton
                mode="carousel"
                icon={RotateCcw}
                label="Carousel"
                isActive={settings.mainViewMode === "carousel"}
                onClick={() => setSettings((prev) => ({ ...prev, mainViewMode: "carousel" }))}
              />
            </div>

            {/* Settings */}
            <div className="flex items-center gap-6">
              <button
                onClick={() => setSettings((prev) => ({ ...prev, sortDescending: !prev.sortDescending }))}
                className="flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-lg hover:bg-white hover:shadow-md transition-all duration-300 transform hover:scale-105 border border-gray-200/50"
              >
                <ArrowUpDown className="w-4 h-4" />
                <span className="text-sm font-medium">{settings.sortDescending ? "Newest First" : "Oldest First"}</span>
              </button>

              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700">Items:</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={settings.itemsPerPage}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      itemsPerPage: Math.min(Math.max(Number.parseInt(e.target.value) || 1, 1), 20),
                    }))
                  }
                  className="w-16 px-3 py-2 bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                />
              </div>

              <ToggleSwitch
                checked={settings.loadMore}
                onChange={(checked) => setSettings((prev) => ({ ...prev, loadMore: checked }))}
                label="Auto Load"
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="mb-8">
          {allItems.length === 0 && !isLoading && !currentApiBase ? (
            <div className="text-center py-16">
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-gray-200/50 max-w-md mx-auto">
                <Settings className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-700 mb-2">Configure WordPress Site</h3>
                <p className="text-gray-500 mb-4">Enter your WordPress site URL to get started</p>
                <button
                  onClick={() => setShowUrlConfig(true)}
                  className="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all duration-300 transform hover:scale-105"
                >
                  Add WordPress URL
                </button>
              </div>
            </div>
          ) : allItems.length === 0 && !isLoading ? (
            <div className="text-center py-16">
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg border border-gray-200/50 max-w-md mx-auto">
                <Settings className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-700 mb-2">No Content Found</h3>
                <p className="text-gray-500">Try adjusting your filters or check back later.</p>
              </div>
            </div>
          ) : (
            <>
              {settings.mainViewMode === "feed" && <FeedView />}
              {settings.mainViewMode === "grid" && <GridView />}
              {settings.mainViewMode === "carousel" && <CarouselView />}
            </>
          )}
        </div>

        {/* Loading */}
        {isLoading && <LoadingSpinner />}

        {/* End Marker */}
        <div ref={endMarkerRef} className="h-10" />

        {/* Popover */}
        {showPopover && currentItem && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white/95 backdrop-blur-lg rounded-3xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden border border-gray-200/50 animate-in slide-in-from-bottom-4 duration-500">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200/50 bg-white/80 backdrop-blur-sm">
                <div className="flex gap-3">
                  <ViewModeButton
                    mode="page"
                    icon={Eye}
                    label="Page"
                    isActive={settings.contentViewMode === "page"}
                    onClick={() => setSettings((prev) => ({ ...prev, contentViewMode: "page" }))}
                  />
                  <ViewModeButton
                    mode="grid"
                    icon={Blocks}
                    label="Blocks"
                    isActive={settings.contentViewMode === "grid"}
                    onClick={() => setSettings((prev) => ({ ...prev, contentViewMode: "grid" }))}
                  />
                </div>

                <button
                  onClick={() => setShowPopover(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-all duration-300 transform hover:scale-110"
                >
                  <X className="w-6 h-6 text-gray-500" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
                {settings.contentViewMode === "page" ? (
                  <div className="prose prose-lg max-w-none">
                    <h2 className="text-3xl font-bold text-gray-800 mb-4">{getItemTitle(currentItem)}</h2>
                    <div className="flex items-center gap-2 text-gray-500 mb-6">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date(currentItem.date).toLocaleDateString()}</span>
                    </div>
                    {getItemImage(currentItem) && (
                      <div className="mb-6 overflow-hidden rounded-2xl shadow-lg">
                        <img
                          src={getItemImage(currentItem) || "/placeholder.svg"}
                          alt={getItemTitle(currentItem)}
                          className="w-full h-auto"
                        />
                      </div>
                    )}
                    <div
                      dangerouslySetInnerHTML={{
                        __html: currentItem.content?.rendered || currentItem.description?.rendered || "",
                      }}
                    />
                  </div>
                ) : (
                  <div>
                    <h3 className="text-2xl font-bold text-gray-800 mb-6">Content Blocks</h3>
                    {contentBlocks.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">No content blocks found</div>
                    ) : (
                      <div className="grid gap-6 md:grid-cols-2">
                        {contentBlocks.map((block, index) => (
                          <div
                            key={index}
                            className="bg-gray-50/80 backdrop-blur-sm p-6 rounded-2xl border border-gray-200/50 shadow-sm hover:shadow-md transition-all duration-300"
                          >
                            <div className="text-xs font-mono text-gray-500 mb-3 bg-white/60 px-2 py-1 rounded-full inline-block">
                              Block {index + 1}
                            </div>
                            <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: block }} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {/* URL Configuration Modal */}
        {showUrlConfig && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white/95 backdrop-blur-lg rounded-3xl shadow-2xl max-w-md w-full border border-gray-200/50 animate-in slide-in-from-bottom-4 duration-500">
              <div className="p-6">
                <h3 className="text-2xl font-bold text-gray-800 mb-2">Configure WordPress Site</h3>
                <p className="text-gray-600 mb-6">Enter your WordPress site URL to load content</p>

                <div className="space-y-4">
                  <div className="relative">
                    <input
                      type="url"
                      value={customUrl}
                      onChange={(e) => handleUrlChange(e.target.value)}
                      placeholder="https://example.com"
                      className="w-full px-4 py-3 pr-12 bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {urlStatus === "checking" && (
                        <div className="w-5 h-5 border-2 border-blue-200 rounded-full animate-spin border-t-blue-500"></div>
                      )}
                      {urlStatus === "valid" && (
                        <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                      {urlStatus === "invalid" && (
                        <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>

                  {urlStatus === "invalid" && (
                    <p className="text-red-500 text-sm">
                      WordPress API not found at this URL. Please check the URL and try again.
                    </p>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setShowUrlConfig(false)}
                      className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all duration-300"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveCustomUrl}
                      disabled={urlStatus !== "valid"}
                      className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                        urlStatus === "valid"
                          ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:shadow-lg transform hover:scale-105"
                          : "bg-gray-200 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      Save & Load
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
