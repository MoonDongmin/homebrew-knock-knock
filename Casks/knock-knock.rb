cask "knock-knock" do
  version "1.1.0"
  sha256 "42483f69d79beee2939a2aa612f19e3e2e0b2c802767eac657a61f7b27b570d4"

  url "https://github.com/MoonDongmin/knock-knock/releases/download/v#{version}/KnockKnock_#{version}_aarch64.dmg"
  name "KnockKnock"
  desc "Detect desk taps via accelerometer and trigger system actions"
  homepage "https://github.com/MoonDongmin/knock-knock"

  depends_on macos: ">= :sonoma"
  depends_on arch: :arm64

  app "KnockKnock.app"

  uninstall launchctl: "com.knockknock.helper",
            delete:    "/Library/LaunchDaemons/com.knockknock.helper.plist"

  zap trash: [
    "~/Library/Application Support/com.knockknock.app",
    "/var/run/com.knockknock.helper.sock",
    "/tmp/knockknock-helper.err.log",
    "/tmp/knockknock-helper.out.log",
  ]
end
