# Maintainer: nandi <nandi@localhost>
pkgname=single-bin
pkgver=1.0.0
pkgrel=1
pkgdesc="A single-tab Chromium-based browser with extension support."
arch=('x86_64')
url="https://github.com/nandi/single"
license=('GPL3')
depends=('electron')
source=("https://github.com/nandi/single/releases/download/v$pkgver/single-$pkgver.pacman")
sha256sums=('SKIP')

package() {
  # Extract the pacman package to the build directory
  tar -xf "single-$pkgver.pacman" -C "$pkgdir"
}
