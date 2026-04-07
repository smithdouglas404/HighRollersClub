import 'dart:math';
import 'package:flame/components.dart';
import 'package:flame/game.dart';
import 'package:flame/particles.dart' as flame_particles;
import 'package:flutter/material.dart';

/// Gemini: "Forge2D (Flame) — If you want the 'All-In' button to catch fire
/// or cards to glow."
///
/// Uses Flame engine for particle-based VFX that would be overkill
/// with pure Flutter widgets but perfect for physics-driven effects.

/// All-In fire effect — particle system with upward flame particles
class AllInFireGame extends FlameGame {
  final Color baseColor;

  AllInFireGame({this.baseColor = const Color(0xFFFF003C)});

  @override
  Future<void> onLoad() async {
    await super.onLoad();
    _spawnFireParticles();
  }

  void _spawnFireParticles() {
    final rng = Random();
    add(
      ParticleSystemComponent(
        particle: flame_particles.Particle.generate(
          count: 30,
          lifespan: 1.5,
          generator: (i) {
            return flame_particles.AcceleratedParticle(
              position: Vector2(size.x / 2 + (rng.nextDouble() - 0.5) * 40, size.y),
              speed: Vector2(
                (rng.nextDouble() - 0.5) * 30,
                -(60 + rng.nextDouble() * 40),
              ),
              acceleration: Vector2(0, -10),
              child: flame_particles.ComputedParticle(
                renderer: (canvas, particle) {
                  final alpha = (1.0 - particle.progress).clamp(0.0, 1.0);
                  final colorShift = Color.lerp(
                    baseColor,
                    const Color(0xFFFFD700),
                    particle.progress,
                  )!;
                  final paint = Paint()
                    ..color = colorShift.withValues(alpha: alpha * 0.8)
                    ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 3);
                  final radius = (3 + rng.nextDouble() * 4) * (1 - particle.progress * 0.5);
                  canvas.drawCircle(Offset.zero, radius, paint);
                },
              ),
            );
          },
        ),
      ),
    );
  }

  @override
  Color backgroundColor() => Colors.transparent;
}

/// Glowing card edge effect — subtle pulsing glow around a card
class CardGlowGame extends FlameGame {
  final Color glowColor;

  CardGlowGame({this.glowColor = const Color(0xFF00F3FF)});

  @override
  Future<void> onLoad() async {
    await super.onLoad();
    _spawnGlowParticles();
  }

  void _spawnGlowParticles() {
    final rng = Random();
    add(
      ParticleSystemComponent(
        particle: flame_particles.Particle.generate(
          count: 20,
          lifespan: 2.0,
          generator: (i) {
            final angle = (i / 20) * 2 * pi;
            final rx = size.x * 0.45;
            final ry = size.y * 0.45;
            return flame_particles.AcceleratedParticle(
              position: Vector2(
                size.x / 2 + cos(angle) * rx,
                size.y / 2 + sin(angle) * ry,
              ),
              speed: Vector2(
                cos(angle) * 5 + (rng.nextDouble() - 0.5) * 10,
                sin(angle) * 5 + (rng.nextDouble() - 0.5) * 10,
              ),
              child: flame_particles.ComputedParticle(
                renderer: (canvas, particle) {
                  final alpha = sin(particle.progress * pi) * 0.6;
                  final paint = Paint()
                    ..color = glowColor.withValues(alpha: alpha.clamp(0.0, 1.0))
                    ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4);
                  canvas.drawCircle(Offset.zero, 2 + rng.nextDouble() * 2, paint);
                },
              ),
            );
          },
        ),
      ),
    );
  }

  @override
  Color backgroundColor() => Colors.transparent;
}

/// Flutter widget wrappers for Flame games
class AllInFireOverlay extends StatelessWidget {
  final double width;
  final double height;

  const AllInFireOverlay({
    super.key,
    this.width = 100,
    this.height = 60,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: width,
      height: height,
      child: GameWidget(game: AllInFireGame()),
    );
  }
}

class CardGlowOverlay extends StatelessWidget {
  final double width;
  final double height;
  final Color color;

  const CardGlowOverlay({
    super.key,
    this.width = 60,
    this.height = 84,
    this.color = const Color(0xFF00F3FF),
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: width,
      height: height,
      child: GameWidget(game: CardGlowGame(glowColor: color)),
    );
  }
}
