"""
QR Code Performance Tests

Tests for performance characteristics:
- Single QR generation time
- Concurrent request handling
- Cache effectiveness
- Memory usage
- Scalability
"""
import sys
from pathlib import Path
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
import importlib.util

# Add backend directory to sys.path
backend_dir = Path(__file__).parent.parent
sys.path.append(str(backend_dir))

# Import qr_generator directly without loading full app
qr_generator_path = backend_dir / "app" / "services" / "qr_generator.py"
spec = importlib.util.spec_from_file_location("qr_generator", qr_generator_path)
qr_generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(qr_generator)

generate_qr_image = qr_generator.generate_qr_image
generate_etag = qr_generator.generate_etag


class TestGenerationPerformance:
    """Test QR generation performance"""

    def test_single_png_generation_time(self):
        """Test single PNG generation completes quickly"""
        url = "https://chestno.ru/q/test123"

        start = time.time()
        image_data = generate_qr_image(url, format="png", size=300, error_correction="M")
        duration = time.time() - start

        assert len(image_data) > 200
        assert duration < 0.1  # Should complete in <100ms
        print(f"OK PNG generation: {duration*1000:.1f}ms ({len(image_data)} bytes)")

    def test_single_svg_generation_time(self):
        """Test single SVG generation completes quickly"""
        url = "https://chestno.ru/q/test123"

        start = time.time()
        image_data = generate_qr_image(url, format="svg", size=300, error_correction="M")
        duration = time.time() - start

        assert len(image_data) > 200
        assert duration < 0.1  # Should complete in <100ms
        print(f"OK SVG generation: {duration*1000:.1f}ms ({len(image_data)} bytes)")

    def test_large_qr_generation_time(self):
        """Test large QR code (2000px) generation time"""
        url = "https://chestno.ru/q/test123"

        start = time.time()
        image_data = generate_qr_image(url, format="png", size=2000, error_correction="H")
        duration = time.time() - start

        assert len(image_data) > 1000
        assert duration < 0.2  # Should complete in <200ms
        print(f"OK Large QR (2000px, H) generation: {duration*1000:.1f}ms ({len(image_data)} bytes)")

    def test_etag_generation_time(self):
        """Test ETag generation is fast"""
        start = time.time()
        for i in range(1000):
            etag = generate_etag(f"code{i}", "png", 300, "M")
        duration = time.time() - start

        avg_time = duration / 1000
        assert avg_time < 0.001  # Should be <1ms per ETag
        print(f"OK ETag generation: {avg_time*1000:.3f}ms average (1000 iterations)")


class TestConcurrentRequests:
    """Test concurrent request handling"""

    def test_10_concurrent_generations(self):
        """Test 10 concurrent QR generations"""
        url = "https://chestno.ru/q/test"

        def generate_qr(index):
            return generate_qr_image(f"{url}{index}", format="png", size=300, error_correction="M")

        start = time.time()
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(generate_qr, i) for i in range(10)]
            results = [future.result() for future in as_completed(futures)]
        duration = time.time() - start

        assert len(results) == 10
        assert all(len(r) > 200 for r in results)
        assert duration < 1.0  # 10 requests in <1s
        print(f"OK 10 concurrent generations: {duration*1000:.1f}ms total ({duration/10*1000:.1f}ms avg)")

    def test_50_concurrent_generations(self):
        """Test 50 concurrent QR generations"""
        url = "https://chestno.ru/q/test"

        def generate_qr(index):
            return generate_qr_image(f"{url}{index}", format="png", size=300, error_correction="M")

        start = time.time()
        with ThreadPoolExecutor(max_workers=50) as executor:
            futures = [executor.submit(generate_qr, i) for i in range(50)]
            results = [future.result() for future in as_completed(futures)]
        duration = time.time() - start

        assert len(results) == 50
        assert all(len(r) > 200 for r in results)
        assert duration < 3.0  # 50 requests in <3s
        print(f"OK 50 concurrent generations: {duration*1000:.1f}ms total ({duration/50*1000:.1f}ms avg)")


class TestCacheEffectiveness:
    """Test cache-related performance"""

    def test_etag_consistency(self):
        """Test ETag generation is consistent"""
        code = "test123"
        format = "png"
        size = 300
        error_correction = "M"

        etag1 = generate_etag(code, format, size, error_correction)
        etag2 = generate_etag(code, format, size, error_correction)

        assert etag1 == etag2
        print(f"OK ETag consistency: {etag1}")

    def test_etag_uniqueness(self):
        """Test different parameters generate different ETags"""
        code = "test123"

        etag_png_300_m = generate_etag(code, "png", 300, "M")
        etag_png_400_m = generate_etag(code, "png", 400, "M")
        etag_svg_300_m = generate_etag(code, "svg", 300, "M")
        etag_png_300_q = generate_etag(code, "png", 300, "Q")

        # All should be different
        etags = [etag_png_300_m, etag_png_400_m, etag_svg_300_m, etag_png_300_q]
        assert len(set(etags)) == 4  # All unique
        print(f"OK ETag uniqueness: 4 different params = 4 unique ETags")


class TestMemoryUsage:
    """Test memory usage characteristics"""

    def test_batch_generation_memory(self):
        """Test batch generation doesn't cause memory issues"""
        url = "https://chestno.ru/q/test"

        # Generate 100 QR codes
        images = []
        for i in range(100):
            image_data = generate_qr_image(f"{url}{i}", format="png", size=300, error_correction="M")
            images.append(image_data)

        # Verify all generated successfully
        assert len(images) == 100
        assert all(len(img) > 200 for img in images)

        total_size = sum(len(img) for img in images)
        avg_size = total_size / 100
        print(f"OK 100 QR generations: {total_size/1024:.1f}KB total ({avg_size:.0f} bytes avg)")

    def test_large_qr_memory(self):
        """Test large QR codes don't cause memory issues"""
        url = "https://chestno.ru/q/" + "x" * 100  # Long URL

        # Generate large QR code
        image_data = generate_qr_image(url, format="png", size=2000, error_correction="H")

        assert len(image_data) > 1000
        print(f"OK Large QR (2000px, long URL): {len(image_data)/1024:.1f}KB")


class TestScalability:
    """Test scalability characteristics"""

    def test_generation_time_scales_linearly(self):
        """Test generation time scales linearly with size"""
        url = "https://chestno.ru/q/test123"
        sizes = [100, 300, 500, 1000, 2000]
        times = []

        for size in sizes:
            start = time.time()
            image_data = generate_qr_image(url, format="png", size=size, error_correction="M")
            duration = time.time() - start
            times.append(duration)
            print(f"  Size {size}px: {duration*1000:.1f}ms ({len(image_data)} bytes)")

        # Larger sizes should take more time, but not exponentially more
        assert times[-1] < times[0] * 20  # 2000px should be <20x slower than 100px
        print(f"OK Scalability: 2000px is {times[-1]/times[0]:.1f}x slower than 100px")

    def test_error_correction_impact(self):
        """Test error correction level impact on performance"""
        url = "https://chestno.ru/q/test123"
        levels = ["L", "M", "Q", "H"]
        times = []

        for level in levels:
            start = time.time()
            image_data = generate_qr_image(url, format="png", size=300, error_correction=level)
            duration = time.time() - start
            times.append(duration)
            print(f"  Level {level}: {duration*1000:.1f}ms ({len(image_data)} bytes)")

        # All levels should have similar performance
        assert max(times) < min(times) * 3  # Max 3x difference
        print(f"OK Error correction impact: max {max(times)/min(times):.1f}x difference")


def run_all_tests():
    """Run all performance tests"""
    print("=" * 60)
    print("QR CODE PERFORMANCE TESTS")
    print("=" * 60)

    # Generation performance
    print("\n[Generation Performance Tests]")
    perf_tests = TestGenerationPerformance()
    perf_tests.test_single_png_generation_time()
    perf_tests.test_single_svg_generation_time()
    perf_tests.test_large_qr_generation_time()
    perf_tests.test_etag_generation_time()

    # Concurrent requests
    print("\n[Concurrent Request Tests]")
    concurrent_tests = TestConcurrentRequests()
    concurrent_tests.test_10_concurrent_generations()
    concurrent_tests.test_50_concurrent_generations()

    # Cache effectiveness
    print("\n[Cache Effectiveness Tests]")
    cache_tests = TestCacheEffectiveness()
    cache_tests.test_etag_consistency()
    cache_tests.test_etag_uniqueness()

    # Memory usage
    print("\n[Memory Usage Tests]")
    memory_tests = TestMemoryUsage()
    memory_tests.test_batch_generation_memory()
    memory_tests.test_large_qr_memory()

    # Scalability
    print("\n[Scalability Tests]")
    scalability_tests = TestScalability()
    scalability_tests.test_generation_time_scales_linearly()
    scalability_tests.test_error_correction_impact()

    print("\n" + "=" * 60)
    print("[OK] ALL PERFORMANCE TESTS PASSED")
    print("=" * 60)


if __name__ == "__main__":
    try:
        run_all_tests()
    except Exception as e:
        print(f"\n[FAIL] PERFORMANCE TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
