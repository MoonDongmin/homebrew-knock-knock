cask "knock-knock" do
  version "1.0.0"
  sha256 "ce568776b07f4a7a28e170a0da368668a218d2516c9d0464658e50bd71114a69"

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
