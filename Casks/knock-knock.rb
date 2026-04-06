cask "knock-knock" do
  version "0.1.0"
  sha256 "edf4f2f46a0d556a62c2854e8cd7024d96763a601e9ac8e46055df2a19317f0a"

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
