// NEXA Core — Pool: zero-GC пул объектов. Главный убийца лагов в JS — аллокации в кадре.
// Использование: const pool = new Pool(() => ({x:0,y:0}), 1024);

export class Pool<T> {
  private free: T[] = [];
  private create: () => T;

  constructor(create: () => T, prealloc = 256) {
    this.create = create;
    for (let i = 0; i < prealloc; i++) this.free.push(create());
  }

  obtain(): T {
    return this.free.pop() ?? this.create();
  }

  release(obj: T): void {
    this.free.push(obj);
  }

  get size(): number { return this.free.length; }
}
