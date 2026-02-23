using System.Diagnostics;

namespace FileLink.Common;

public class ThrottledStream : Stream
{
    private readonly Stream _baseStream;
    private readonly int _bytesPerSecond;
    private readonly Stopwatch _stopwatch = Stopwatch.StartNew();
    private long _totalBytesTransferred;

    public ThrottledStream(Stream baseStream, int kbPerSecond)
    {
        _baseStream = baseStream;
        _bytesPerSecond = kbPerSecond * 1024;
    }

    public override bool CanRead => _baseStream.CanRead;
    public override bool CanSeek => _baseStream.CanSeek;
    public override bool CanWrite => _baseStream.CanWrite;
    public override long Length => _baseStream.Length;
    public override long Position
    {
        get => _baseStream.Position;
        set => _baseStream.Position = value;
    }

    public override int Read(byte[] buffer, int offset, int count)
    {
        Throttle().GetAwaiter().GetResult();
        int bytesRead = _baseStream.Read(buffer, offset, count);
        _totalBytesTransferred += bytesRead;
        return bytesRead;
    }

    public override async Task<int> ReadAsync(byte[] buffer, int offset, int count, CancellationToken cancellationToken)
    {
        await Throttle();
        int bytesRead = await _baseStream.ReadAsync(buffer, offset, count, cancellationToken);
        _totalBytesTransferred += bytesRead;
        return bytesRead;
    }

    public override async ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default)
    {
        await Throttle();
        int bytesRead = await _baseStream.ReadAsync(buffer, cancellationToken);
        _totalBytesTransferred += bytesRead;
        return bytesRead;
    }

    public override void Write(byte[] buffer, int offset, int count)
    {
        Throttle().GetAwaiter().GetResult();
        _baseStream.Write(buffer, offset, count);
        _totalBytesTransferred += count;
    }

    public override async Task WriteAsync(byte[] buffer, int offset, int count, CancellationToken cancellationToken)
    {
        await Throttle();
        await _baseStream.WriteAsync(buffer, offset, count, cancellationToken);
        _totalBytesTransferred += count;
    }

    public override async ValueTask WriteAsync(ReadOnlyMemory<byte> buffer, CancellationToken cancellationToken = default)
    {
        await Throttle();
        await _baseStream.WriteAsync(buffer, cancellationToken);
        _totalBytesTransferred += buffer.Length;
    }

    private async Task Throttle()
    {
        if (_totalBytesTransferred <= 0) return;

        var elapsedSeconds = _stopwatch.Elapsed.TotalSeconds;
        var expectedSeconds = (double)_totalBytesTransferred / _bytesPerSecond;
        var delayMs = (expectedSeconds - elapsedSeconds) * 1000;

        if (delayMs > 0)
        {
            await Task.Delay((int)delayMs);
        }
    }

    public override void Flush() => _baseStream.Flush();
    public override Task FlushAsync(CancellationToken cancellationToken) => _baseStream.FlushAsync(cancellationToken);
    public override long Seek(long offset, SeekOrigin origin) => _baseStream.Seek(offset, origin);
    public override void SetLength(long value) => _baseStream.SetLength(value);

    protected override void Dispose(bool disposing)
    {
        if (disposing)
            _baseStream.Dispose();
        base.Dispose(disposing);
    }
}
