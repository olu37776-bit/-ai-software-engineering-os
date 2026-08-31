using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Threading;

internal static class ProcessRestrictedFixture
{
    private static Process StartSelf(string arguments)
    {
        var start = new ProcessStartInfo
        {
            FileName = Process.GetCurrentProcess().MainModule.FileName,
            Arguments = arguments,
            UseShellExecute = false,
            CreateNoWindow = true
        };
        return Process.Start(start);
    }

    private static int Main(string[] args)
    {
        Console.OutputEncoding = new UTF8Encoding(false);
        if (args.Length == 0) return 64;
        switch (args[0])
        {
            case "smoke":
                Console.WriteLine("CWD=" + Environment.CurrentDirectory);
                Console.WriteLine("ALLOWED=" + (Environment.GetEnvironmentVariable("ASEOS_ALLOWED") ?? "<missing>"));
                Console.WriteLine("SECRET=" + (Environment.GetEnvironmentVariable("ASEOS_SECRET") ?? "<missing>"));
                Console.WriteLine("INPUT=" + File.ReadAllText(args[1], Encoding.UTF8));
                Console.Error.WriteLine("STDERR=controlled");
                return 0;
            case "tree-root":
                var child = StartSelf("tree-child");
                Console.WriteLine("ROOT=" + Process.GetCurrentProcess().Id);
                Console.WriteLine("CHILD=" + child.Id);
                Console.Out.Flush();
                var grandchildPath = Path.Combine(Environment.CurrentDirectory, "grandchild.pid");
                for (var attempt = 0; attempt < 100 && !File.Exists(grandchildPath); attempt++)
                {
                    Thread.Sleep(10);
                }
                if (File.Exists(grandchildPath))
                {
                    Console.WriteLine("GRANDCHILD=" + File.ReadAllText(grandchildPath));
                    Console.Out.Flush();
                }
                Thread.Sleep(Timeout.Infinite);
                return 0;
            case "tree-child":
                var grandchild = StartSelf("tree-grandchild");
                File.WriteAllText(
                    Path.Combine(Environment.CurrentDirectory, "grandchild.pid"),
                    grandchild.Id.ToString()
                );
                Thread.Sleep(Timeout.Infinite);
                return 0;
            case "tree-grandchild":
                Thread.Sleep(Timeout.Infinite);
                return 0;
            case "spawn-child":
                try
                {
                    var spawned = StartSelf("tree-grandchild");
                    Console.WriteLine("SPAWNED=" + spawned.Id);
                    Console.Out.Flush();
                    Thread.Sleep(1500);
                    return spawned.HasExited ? 0 : 65;
                }
                catch (Exception error)
                {
                    Console.WriteLine("SPAWN_FAILED=" + error.GetType().Name);
                    return 0;
                }
            case "stdout":
                var count = Int32.Parse(args[1]);
                Console.Write(new string('x', count));
                return 0;
            case "stderr":
                var errorCount = Int32.Parse(args[1]);
                Console.Error.Write(new string('e', errorCount));
                return 0;
            case "cpu":
                var watch = Stopwatch.StartNew();
                long accumulator = 0;
                while (watch.ElapsedMilliseconds < 60000)
                {
                    accumulator ^= watch.ElapsedTicks;
                }
                Console.WriteLine(accumulator);
                return 0;
            case "memory":
                var allocations = new List<byte[]>();
                while (true)
                {
                    var block = new byte[1024 * 1024];
                    for (var index = 0; index < block.Length; index += 4096) block[index] = 1;
                    allocations.Add(block);
                    Thread.Sleep(5);
                }
            default:
                return 64;
        }
    }
}
