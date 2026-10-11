import AppKit

// Redraws every capture of a capture set into sRGB, so pixels can be compared with browser screenshots. A window with
// menu layers is written as one composite, with the window and its menus at their recorded offsets. The composite's
// frame holds them all, and is the same frame the lab gives the web side.
// Usage: swift srgb.swift <captures-dir> <out-dir>
struct Size: Decodable { let width: Double; let height: Double }
struct Offset: Decodable { let x: Double; let y: Double }
struct Layer: Decodable { let file: String; let offset: Offset; let size: Size }
struct Capture: Decodable { let file: String; let size: Size; let layers: [Layer] }
struct CaptureJSON: Decodable { let displayScale: Double; let captures: [Capture] }

let arguments = CommandLine.arguments
guard arguments.count == 3 else {
    FileHandle.standardError.write(Data("usage: srgb.swift <captures-dir> <out-dir>\n".utf8))
    exit(2)
}
let input = URL(fileURLWithPath: arguments[1])
let output = URL(fileURLWithPath: arguments[2])
try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
let set = try JSONDecoder().decode(CaptureJSON.self, from: Data(contentsOf: input.appendingPathComponent("capture.json")))
let scale = set.displayScale
guard scale == 2 else {
    FileHandle.standardError.write(Data("displayScale is \(scale); shoot.sh and measure.py expect 2\n".utf8))
    exit(1)
}

func image(_ name: String) -> CGImage {
    guard let source = CGImageSourceCreateWithURL(input.appendingPathComponent(name) as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else { fatalError("cannot read \(name)") }
    return image
}

for capture in set.captures {
    let rects = [CGRect(x: 0, y: 0, width: capture.size.width, height: capture.size.height)]
        + capture.layers.map { CGRect(x: $0.offset.x, y: $0.offset.y, width: $0.size.width, height: $0.size.height) }
    let frame = rects.reduce(rects[0]) { $0.union($1) }
    let width = Int((frame.width * scale).rounded()), height = Int((frame.height * scale).rounded())
    let context = CGContext(
        data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
        space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    )!
    // Core Graphics counts y from the bottom.
    func draw(_ name: String, _ rect: CGRect) {
        let x = (rect.minX - frame.minX) * scale, y = (frame.maxY - rect.maxY) * scale
        context.draw(image(name), in: CGRect(x: x, y: y, width: rect.width * scale, height: rect.height * scale))
    }
    draw(capture.file, rects[0])
    for (layer, rect) in zip(capture.layers, rects.dropFirst()) { draw(layer.file, rect) }
    let png = NSBitmapImageRep(cgImage: context.makeImage()!).representation(using: .png, properties: [:])!
    try png.write(to: output.appendingPathComponent(capture.file))
}
print("\(set.captures.count) captures written to \(output.path)")
