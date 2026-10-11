"""Pytest test runner and compatibility layer for standalone execution.

Supports:
- @pytest.fixture and @pytest.fixture()
- Generator fixtures (yield) with teardown
- Chained/nested fixtures
- with pytest.raises(ExceptionClass) as exc_info:
- CLI execution: python3 pytest.py or python3 -m pytest
"""

import inspect
import os
import sys
import traceback
from typing import Any, Callable, Dict, List, Tuple

_GLOBAL_FIXTURES: Dict[str, Callable] = {}


def fixture(func: Callable = None, *args, **kwargs):
    def decorator(f):
        f._is_fixture = True
        _GLOBAL_FIXTURES[f.__name__] = f
        return f

    if func is not None and callable(func):
        return decorator(func)
    return decorator


class raises:
    def __init__(self, expected_exception, *args, **kwargs):
        self.expected_exception = expected_exception
        self.value = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is None:
            raise AssertionError(f"DID NOT RAISE {self.expected_exception}")
        if issubclass(exc_type, self.expected_exception):
            self.value = exc_val
            return True
        return False


def _get_fixture_fn(name: str, mod: Any) -> Callable:
    if hasattr(mod, name):
        attr = getattr(mod, name)
        if callable(attr) and getattr(attr, "_is_fixture", False):
            return attr
    if name in _GLOBAL_FIXTURES:
        return _GLOBAL_FIXTURES[name]
    # Check if attribute exists in module even if not explicitly decorated
    if hasattr(mod, name):
        attr = getattr(mod, name)
        if callable(attr):
            return attr
    return None


def _resolve_fixture_recursive(
    name: str,
    mod: Any,
    cache: Dict[str, Any],
    cleanups: List[Any],
    resolving_stack: List[str],
) -> Any:
    if name in cache:
        return cache[name]

    if name in resolving_stack:
        raise RuntimeError(f"Cyclic fixture dependency detected: {' -> '.join(resolving_stack + [name])}")

    fixture_fn = _get_fixture_fn(name, mod)
    if fixture_fn is None:
        raise ValueError(f"Fixture '{name}' not found in module {getattr(mod, '__name__', '')} or globally.")

    sig = inspect.signature(fixture_fn)
    child_kwargs = {}
    for param_name in sig.parameters:
        child_val = _resolve_fixture_recursive(
            param_name, mod, cache, cleanups, resolving_stack + [name]
        )
        child_kwargs[param_name] = child_val

    result = fixture_fn(**child_kwargs)
    if inspect.isgenerator(result):
        try:
            val = next(result)
            cleanups.append(result)
            cache[name] = val
            return val
        except StopIteration:
            cache[name] = None
            return None
    else:
        cache[name] = result
        return result


def run_tests():
    test_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tests")
    if not os.path.isdir(test_dir):
        print(f"Directory {test_dir} not found.")
        sys.exit(1)

    sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
    test_files = sorted([f for f in os.listdir(test_dir) if f.startswith("test_") and f.endswith(".py")])

    total_run = 0
    total_passed = 0
    failures: List[Tuple[str, str]] = []

    print(f"=== Running test suite across {len(test_files)} files in tests/ ===")

    for fname in test_files:
        mod_name = f"tests.{fname[:-3]}"
        try:
            mod = __import__(mod_name, fromlist=["*"])
        except Exception:
            failures.append((f"{mod_name} (IMPORT ERROR)", traceback.format_exc()))
            print(f"✗ {mod_name} (Failed to import)")
            continue

        test_names = [a for a in dir(mod) if a.startswith("test_") and callable(getattr(mod, a))]

        for tname in test_names:
            test_fn = getattr(mod, tname)
            total_run += 1
            cache: Dict[str, Any] = {}
            cleanups: List[Any] = []

            try:
                sig = inspect.signature(test_fn)
                kwargs = {}
                for param_name in sig.parameters:
                    val = _resolve_fixture_recursive(param_name, mod, cache, cleanups, [])
                    kwargs[param_name] = val

                test_fn(**kwargs)
                total_passed += 1
                print(f"  ✓ {fname}::{tname}")
            except Exception:
                failures.append((f"{fname}::{tname}", traceback.format_exc()))
                print(f"  ✗ {fname}::{tname}")
            finally:
                for gen in reversed(cleanups):
                    try:
                        next(gen)
                    except StopIteration:
                        pass
                    except Exception as e:
                        print(f"Warning: error during fixture teardown: {e}")

    print("\n" + "=" * 60)
    print(f"Test Suite Results: {total_passed}/{total_run} passed ({len(failures)} failed)")
    print("=" * 60)

    if failures:
        print("\n--- Failure Details ---")
        for name, tb in failures:
            print(f"\n[FAIL] {name}:")
            print(tb)
        sys.exit(1)
    else:
        print("SUCCESS: All tests passed cleanly.")
        sys.exit(0)


if __name__ == "__main__":
    run_tests()
