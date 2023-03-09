import envPaths from 'env-paths';
import {readFile, writeFile, mkdir, unlink, rm} from 'node:fs/promises';
import slugify from 'slugify';
import path from 'node:path';

export type ValueEncoding = BufferEncoding | null;
export type Value = string | Buffer;
/**
 * Represents a "value", which is just a file on disk containing something.
 *
 * A {@linkcode ValueWrapper} does not know anything about where it is stored, or how it is stored.
 */
export interface ValueWrapper<V extends Value> {
  /**
   * Slugified name
   */
  id: string;
  /**
   * Name of value
   */
  name: string;

  /**
   * Encoding of value
   */
  encoding: ValueEncoding;
  /**
   * Read value from disk
   */
  look(): Promise<V>;
  /**
   * Write to value
   * @param value New value to write to value
   */
  put(value: V): Promise<void>;

  /**
   * Current value, if any
   */
  get value(): V | undefined;
}

/**
 * A function which reads from a value
 */
export interface ValueLooker<V extends Value> {
  (value: ValueWrapper<V>): Promise<V>;
}
/**
 * A function which writes to a value
 */
export interface ValuePutter<V extends Value> {
  (value: ValueWrapper<V>, data: V): Promise<void>;
}

/**
 * A value which stores its value in a file on disk
 *
 * This class is not intended to be instantiated directly
 *
 */
export class BaseValueWrapper<V extends Value> implements ValueWrapper<V> {
  /**
   * Underlying value
   */
  #value: V | undefined;

  /**
   * Slugified name
   */
  public readonly id: string;
  /**
   * Function which reads a value
   */
  private readonly looker: ValueLooker<V>;
  /**
   * Function which writes a value
   */
  private readonly putter: ValuePutter<V>;

  /**
   * Underlying value
   */
  public readonly value: V;

  /**
   * Slugifies the name
   * @param name Name of value
   * @param looker Reader fn
   * @param putter Writer fn
   * @param encoding Defaults to `utf8`
   */
  constructor(
    public readonly name: string,
    looker: ValueLooker<V>,
    putter: ValuePutter<V>,
    public readonly encoding: ValueEncoding = 'utf8'
  ) {
    this.id = slugify(name, {lower: true});

    Object.defineProperties(this, {
      looker: {value: looker},
      putter: {value: putter},
      value: {
        get() {
          return this.#value;
        },
        enumerable: true,
      },
    });
  }

  /**
   * {@inheritdoc IValueWrapper.read}
   */
  async look(): Promise<V> {
    this.#value = await this.looker(this);
    return this.#value;
  }

  /**
   * {@inheritdoc IValueWrapper.write}
   */
  async put(value: V): Promise<void> {
    await this.putter(this, value);
    this.#value = value;
  }
}

/**
 * @see {@linkcode ValueBoxOpts}
 */
export const DEFAULT_SUFFIX = 'valuebox';

/**
 * A class which instantiates a {@linkcode ValueWrapper}.
 */
export interface ValueConstructor<V extends Value> {
  new (
    name: string,
    reader: ValueLooker<V>,
    writer: ValuePutter<V>,
    encoding?: ValueEncoding
  ): ValueWrapper<V>;
}

/**
 * Main entry point for use of this module
 *
 * Manages multiple values.
 */
export class ValueBox {
  /**
   * Slugified name of this container; corresponds to the directory name.
   *
   * If `dir` is provided, this value is unused.
   * If `suffix` is provided, then this will be the parent directory of `suffix`.
   */
  public readonly containerId: string;
  /**
   * Override the directory of this container.
   *
   * If this is present, both `suffix` and `containerId` are unused.
   */
  public readonly dir: string;

  protected ctor?: ValueConstructor<any>;

  /**
   * Factory function for creating new {@linkcode ValueWrapper}s}
   */
  protected wrapperIds: Set<string> = new Set();

  protected constructor(
    public readonly name: string,
    {dir, suffix = DEFAULT_SUFFIX, defaultCtor: ctor = BaseValueWrapper}: ValueBoxOpts = {}
  ) {
    this.containerId = slugify(name, {lower: true});
    this.ctor = ctor;
    this.dir = dir ?? path.join(envPaths(this.containerId).data, suffix);
  }

  /**
   * "mkdirp"'s the value directory and writes it to disk
   * @param value ValueWrapper to write
   * @param value Value to write to the value
   */
  private async put<V extends Value>(wrapper: ValueWrapper<V>, value: string): Promise<void> {
    await this.init();
    await writeFile(path.join(this.dir, wrapper.id), value, wrapper.encoding);
  }

  /**
   * "mkdirp"'s the value directory
   */
  private async init(): Promise<void> {
    await mkdir(this.dir, {recursive: true});
  }

  /**
   * Removes _all_ values from disk by truncating the value directory.
   *
   * Convniently removes everything else in the value directory, even if it isn't a value!
   */
  public async recycleAll() {
    try {
      await rm(this.dir, {recursive: true, force: true});
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw e;
      }
    }
  }
  /**
   * Reads a value in a value from disk
   * @param value ValueWrapper to read
   */
  protected async look<V extends Value>(wrapper: ValueWrapper<V>): Promise<V | undefined> {
    try {
      return (await readFile(path.join(this.dir, wrapper.id), {
        encoding: wrapper.encoding,
      })) as V;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw e;
      }
    }
  }

  /**
   * Removes a value from disk.
   *
   * This does _not_ destroy the `ValueWrapper` instance in memory, nor does it allow the `id` to be reused.
   * @param wrapper ValueWrapper to drop
   */
  async recycle(wrapper: ValueWrapper<Value>) {
    try {
      await unlink(path.join(this.dir, wrapper.id));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw e;
      }
    }
  }

  /**
   * Create a new {@linkcode ValueWrapper}. Reads the value from disk, if present.
   * @param name Name of value
   * @param encoding Encoding of value; defaults to `utf8`
   * @returns New value
   */
  async createWrapper<V extends Value>(
    name: string,
    encoding?: ValueEncoding
  ): Promise<ValueWrapper<V>> {
    const wrapper = new (this.ctor as ValueConstructor<V>)(
      name,
      this.look.bind(this),
      this.put.bind(this),
      encoding
    );
    if (this.wrapperIds.has(wrapper.id)) {
      throw new Error(`ValueWrapper with id "${wrapper.id}" already exists`);
    }
    try {
      await wrapper.look();
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw e;
      }
    }
    this.wrapperIds.add(wrapper.id);
    return wrapper;
  }

  /**
   * Creates a {@linkcode ValueWrapper} then immediately writes a value to it.
   * If there was anything on disk, it is overwritten.
   * @param name Name of value
   * @param value Value to write
   * @returns New `ValueWrapper` w/ value of `value`
   */
  async createWrapperWithValue<V extends Value>(
    name: string,
    value: V,
    encoding?: ValueEncoding
  ): Promise<ValueWrapper<V>> {
    const wrapper = await this.createWrapper<V>(name, encoding);
    await wrapper.put(value);
    return wrapper;
  }

  /**
   * Creates a new {@linkcode ValueBox}
   * @param name Name of value container
   * @param opts Options
   * @returns New value
   */
  static create(name: string, opts?: ValueBoxOpts) {
    return new ValueBox(name, opts);
  }
}

export interface ValueBox {
  /**
   * Creates a new {@linkcode ValueBox}
   * @param name Name of value container
   * @param opts Options
   * @returns New value
   */
  create(name: string, opts?: ValueBoxOpts): ValueBox;
}

export interface ValueBoxOpts {
  /**
   * Override default value directory, which is chosen according to environment
   */
  dir?: string;

  /**
   * Extra subdir to append to the auto-generated value directory. Ignored if `dir` is a `string`.
   * @defaultValue 'valuebox'
   */
  suffix?: string;

  defaultCtor?: ValueConstructor<any>;
}
