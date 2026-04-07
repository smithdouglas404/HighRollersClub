import 'dart:math';
import 'package:flutter/material.dart';

/// Golden particle burst effect when a player wins.
/// Uses CustomPainter for high performance rendering.
class WinnerParticles extends StatefulWidget {
  const WinnerParticles({super.key});

  @override
  State<WinnerParticles> createState() => _WinnerParticlesState();
}

class _WinnerParticlesState extends State<WinnerParticles>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late List<_Particle> _particles;
  final _rng = Random();

  static const _colors = [
    Color(0xFFFFD700),
    Color(0xFFF5E6A3),
    Color(0xFFE8C566),
    Color(0xFFFFF8DC),
    Color(0xFFD4A843),
  ];

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    )..forward();

    // Spawn 50 particles from center
    _particles = List.generate(50, (_) {
      final angle = _rng.nextDouble() * 2 * pi;
      final speed = 1.5 + _rng.nextDouble() * 3;
      return _Particle(
        x: 80,
        y: 80,
        vx: cos(angle) * speed,
        vy: sin(angle) * speed - 2,
        size: 2 + _rng.nextDouble() * 4,
        color: _colors[_rng.nextInt(_colors.length)],
        life: 1.0,
        decay: 0.3 + _rng.nextDouble() * 0.4,
      );
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return CustomPaint(
          size: const Size(160, 160),
          painter: _ParticlePainter(
            particles: _particles,
            progress: _controller.value,
          ),
        );
      },
    );
  }
}

class _Particle {
  double x, y, vx, vy, size, life, decay;
  Color color;

  _Particle({
    required this.x,
    required this.y,
    required this.vx,
    required this.vy,
    required this.size,
    required this.color,
    required this.life,
    required this.decay,
  });
}

class _ParticlePainter extends CustomPainter {
  final List<_Particle> particles;
  final double progress;

  _ParticlePainter({required this.particles, required this.progress});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint();

    for (final p in particles) {
      // Update position
      final t = progress;
      final x = p.x + p.vx * t * 80;
      final y = p.y + (p.vy * t * 80) + (t * t * 120); // gravity
      final alpha = (1.0 - t / p.decay).clamp(0.0, 1.0);

      if (alpha <= 0) continue;

      paint.color = p.color.withValues(alpha: alpha);
      canvas.drawCircle(Offset(x, y), p.size * (1 - t * 0.3), paint);

      // Glow effect
      paint.color = p.color.withValues(alpha: alpha * 0.3);
      canvas.drawCircle(Offset(x, y), p.size * 2 * (1 - t * 0.3), paint);
    }
  }

  @override
  bool shouldRepaint(_ParticlePainter old) => old.progress != progress;
}
