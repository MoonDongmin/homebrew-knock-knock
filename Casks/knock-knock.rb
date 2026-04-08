cask "knock-knock" do
  version "1.0.0"
  sha256 "33ed775e5b65ec4ac937cc1013d68d7d1d5dafd8d3cb32ad457fec999318a2d5"

  url "https://github.com/MoonDongmin/knock-knock/releases/download/v#{version}/KnockKnock_#{version}_aarch64.dmg"
  name "KnockKnock"
  desc "Detect desk taps via accelerometer and trigger system actions"
  homepage "https://github.com/MoonDongmin/knock-knock"

  depends_on macos: ">= :sonoma"
  depends_on arch: :arm64

  app "KnockKnock.app"

  zap trash: [
    "~/Library/Application Support/com.knockknock.app",
  ]
end
