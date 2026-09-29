import type { QuestionSeed } from "@/lib/question-bank";

type Draft = Omit<QuestionSeed, "seedKey" | "options" | "answer"> & {
  seedKey: string;
  options?: string[];
  answer: string | string[];
};

function makeItem(draft: Draft): QuestionSeed {
  const { seedKey, options = [], ...rest } = draft;
  return { seedKey: `pack-${seedKey}`, options, ...rest };
}

function makeMcq(draft: Omit<Draft, "options" | "answer">, correct: string, distractors: string[]) {
  const choices = [correct, ...distractors].map((option) => String(option));
  while (new Set(choices).size < 4) choices.push(String(Number(correct) + choices.length + 1));
  const unique = [...new Set(choices)].slice(0, 4);
  const offset = Math.abs(Number(draft.seedKey.match(/\d+$/)?.[0] ?? 0)) % unique.length;
  const options = [...unique.slice(offset), ...unique.slice(0, offset)];
  return makeItem({ ...draft, type: "MCQ", options, answer: correct });
}

function nat(draft: Omit<Draft, "options" | "answer">, answer: number | bigint, digits?: number) {
  const value = typeof answer === "bigint" ? answer.toString() : digits === undefined ? String(answer) : answer.toFixed(digits);
  return makeItem({ ...draft, type: "NAT", options: [], answer: value });
}

function common(
  seedKey: string,
  question: string,
  subject: string,
  topic: string,
  subtopic: string,
  index: number,
  type: "MCQ" | "MSQ" | "NAT",
  bloom: 3 | 4 | 5,
  marks: 1 | 2,
  explanation: string,
  commonMistakes: string[],
): Omit<Draft, "options" | "answer"> {
  const estimatedSeconds = marks === 2 ? 180 : 90;
  return {
    seedKey,
    question,
    subject,
    topic,
    subtopic,
    type,
    marks,
    difficulty: [-0.15, 0.3, 0.55, 0.75, 1.05, 1.2][index % 6],
    discrimination: Number((1.05 + (index % 6) * 0.08).toFixed(2)),
    guessing: type === "MCQ" ? 0.25 : type === "MSQ" ? 0.03 : 0,
    bloom,
    estimatedSeconds,
    explanation,
    commonMistakes,
    source: "Generated · parameterized practice",
  };
}

function ontoCount(domainSize: number, codomainSize: number) {
  let total = BigInt(0);
  for (let omitted = 0; omitted <= codomainSize; omitted += 1) {
    const choose = binomial(codomainSize, omitted);
    const term = BigInt(codomainSize - omitted) ** BigInt(domainSize);
    total += omitted % 2 === 0 ? choose * term : -(choose * term);
  }
  return total;
}

function binomial(n: number, r: number) {
  if (r < 0 || r > n) return BigInt(0);
  let result = BigInt(1);
  for (let step = 1; step <= Math.min(r, n - r); step += 1) {
    result = (result * BigInt(n - step + 1)) / BigInt(step);
  }
  return result;
}

function fifoFaults(references: number[], frameCount: number) {
  const frames: number[] = [];
  let faults = 0;
  for (const page of references) {
    if (frames.includes(page)) continue;
    faults += 1;
    if (frames.length < frameCount) frames.push(page);
    else frames.shift(), frames.push(page);
  }
  return faults;
}

function generatedFor(index: number): QuestionSeed {
  const group = Math.floor(index / 200);
  const variant = index % 200;
  const key = `${String(group + 1).padStart(2, "0")}-${String(variant + 1).padStart(3, "0")}`;

  switch (group) {
    case 0: {
      const [a, b, c, d] = [2 + (variant % 17), 3 + ((variant * 5) % 19), 1 + ((variant * 7) % 13), 4 + ((variant * 3) % 11)];
      const result = (a + b) * (c + d);
      const draft = common(
        `stack-${key}`,
        `A stack evaluates the postfix expression “${a} ${b} + ${c} ${d} + *”. What value remains?`,
        "Programming & Data Structures",
        "Stacks",
        "Postfix evaluation",
        variant,
        "MCQ",
        3,
        1,
        `First compute ${a} + ${b} = ${a + b} and ${c} + ${d} = ${c + d}. The final multiplication gives ${result}.`,
        ["Applying an operator before both operands are on the stack", "Reading a postfix expression as ordinary infix notation", "Stopping after the first addition"],
      );
      return makeMcq(draft, String(result), [String(a + b + c + d), String(a * b + c * d), String(a * b * c * d)]);
    }
    case 1: {
      const prefix = 24 + (variant % 7);
      const ip = `192.168.${Math.floor(variant / 32)}.${(variant * 13) % 256}/${prefix}`;
      const hosts = 2 ** (32 - prefix) - 2;
      const draft = common(
        `subnet-${key}`,
        `For an ordinary IPv4 subnet written as ${ip}, how many host addresses are assignable to end devices?`,
        "Computer Networks",
        "IP addressing",
        "IPv4 subnetting",
        variant,
        "NAT",
        3,
        1,
        `There are ${32 - prefix} host bits, so the subnet contains 2^${32 - prefix} addresses. Excluding the network and broadcast addresses leaves ${hosts}.`,
        ["Reporting the total number of addresses without subtracting network and broadcast", "Using 24 as the total number of IPv4 bits", "Subtracting an extra reserved address"],
      );
      return nat(draft, hosts);
    }
    case 2: {
      const domain = 3 + (variant % 40);
      const codomain = 2 + Math.floor(variant / 40);
      const answer = ontoCount(domain, codomain);
      const draft = common(
        `onto-${key}`,
        `How many onto functions are there from a set of ${domain} elements to a set of ${codomain} elements?`,
        "Engineering Mathematics",
        "Combinatorics",
        "Inclusion–exclusion and surjections",
        variant,
        "NAT",
        4,
        2,
        `By inclusion–exclusion, the count is Σⱼ₌₀^${codomain} (−1)ʲ C(${codomain}, j) (${codomain}−j)^${domain} = ${answer}.`,
        ["Counting every function without excluding maps that miss an output", "Using permutations instead of functions", "Assuming an onto function exists when the domain is smaller than the codomain"],
      );
      return nat(draft, answer);
    }
    case 3: {
      const suffix = variant.toString(2).padStart(8, "0");
      const correct = "9";
      const draft = common(
        `dfa-${key}`,
        `Over {0,1}, what is the minimum number of states in a DFA accepting exactly the strings that end with the 8-bit suffix ${suffix}?`,
        "Theory of Computation",
        "Finite automata",
        "DFA minimization and suffix matching",
        variant,
        "MCQ",
        4,
        2,
        `A DFA tracking the longest matched prefix of a fixed suffix of length m needs m+1 distinguishable states. Here m=8, so the minimum is 9.`,
        ["Using eight states because the suffix has eight symbols", "Adding a separate dead state for a DFA that has transitions on both symbols", "Counting accepting suffixes instead of distinguishable prefixes"],
      );
      return makeMcq(draft, correct, ["8", "10", "7"]);
    }
    case 4: {
      const bursts = [2 + (variant % 15), 1 + ((variant * 7) % 13), 1 + ((variant * 11) % 17)];
      const waits = [0, bursts[0], bursts[0] + bursts[1]];
      const average = waits.reduce((sum, time) => sum + time, 0) / waits.length;
      const draft = common(
        `fcfs-${key}`,
        `Three processes arrive together and run in FCFS order with CPU bursts ${bursts.join(", ")} ms. Enter their average waiting time in ms, to two decimal places.`,
        "Operating Systems",
        "CPU scheduling",
        "FCFS waiting time",
        variant,
        "NAT",
        3,
        2,
        `The waiting times are 0, ${bursts[0]}, and ${bursts[0] + bursts[1]} ms. Their mean is ${waits.join(" + ")} divided by 3 = ${average.toFixed(2)} ms.`,
        ["Averaging burst lengths instead of waiting times", "Including a process's own execution time in its waiting time", "Using a different order from the stated FCFS order"],
      );
      return nat(draft, average, 2);
    }
    case 5: {
      const hitTime = 2 + (variant % 29);
      const hitRatio = (5 + (variant % 5)) / 10;
      const missPenalty = 40 + ((variant * 17) % 181);
      const answer = hitTime + (1 - hitRatio) * missPenalty;
      const draft = common(
        `amat-${key}`,
        `A cache has hit time ${hitTime} ns, hit ratio ${hitRatio.toFixed(1)}, and an additional miss penalty of ${missPenalty} ns. Using AMAT = hit time + miss rate × miss penalty, enter AMAT in ns.`,
        "Computer Organization & Architecture",
        "Memory hierarchy",
        "Average memory access time",
        variant,
        "NAT",
        3,
        1,
        `The miss rate is 1 − ${hitRatio.toFixed(1)} = ${(1 - hitRatio).toFixed(1)}. AMAT = ${hitTime} + ${(1 - hitRatio).toFixed(1)} × ${missPenalty} = ${answer.toFixed(2)} ns.`,
        ["Using hit rate instead of miss rate", "Adding the full miss penalty to every access", "Multiplying the hit time by the miss rate"],
      );
      return nat(draft, answer, 2);
    }
    case 6: {
      const candidates: [number, number][] = [[1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4]];
      const edges = candidates.filter((_, edgeIndex) => ((variant * 17 + edgeIndex * 11) % 7) < 4);
      const cycle = variant % 2 === 1;
      if (cycle) edges.push([1, 4], [4, 1]);
      if (!edges.length) edges.push([1, 2]);
      const label = edges.map(([from, to]) => `T${from}→T${to}`).join(", ");
      const draft = common(
        `precedence-${key}`,
        `A schedule has precedence-graph edges ${label}. Is the schedule conflict-serializable?`,
        "Databases",
        "Transactions",
        "Conflict serializability",
        variant,
        "MCQ",
        4,
        1,
        cycle ? "The edge T4→T1 closes a directed cycle with at least one forward path from T1 to T4. A cyclic precedence graph means the schedule is not conflict-serializable." : "All listed edges point from a lower-numbered transaction to a higher-numbered transaction, so the graph is acyclic. An acyclic precedence graph is conflict-serializable.",
        ["Confusing a conflict-serial schedule with any serial schedule", "Using transaction number order rather than the directions of all graph edges", "Assuming every edge automatically makes a cycle"],
      );
      return makeMcq(draft, cycle ? "No" : "Yes", [cycle ? "Yes" : "No", "Only if all transactions commit", "Cannot be determined from a precedence graph"]);
    }
    case 7: {
      const indexLabel = String(variant + 1).padStart(3, "0");
      const firstTerminal = `x${indexLabel}`;
      const followTerminal = `y${indexLabel}`;
      const draft = common(
        `follow-${key}`,
        `For S → A ${followTerminal}, A → ${firstTerminal}A | ε, what is FOLLOW(A)?`,
        "Compiler Design",
        "Parsing",
        "FIRST and FOLLOW sets",
        variant,
        "MCQ",
        4,
        1,
        `In S→A ${followTerminal}, A is immediately followed by terminal ${followTerminal}. It is not at the end of a production, so FOLLOW(A) = {${followTerminal}}.`,
        [`Adding ${firstTerminal}, which belongs to FIRST(A), instead of FOLLOW(A)`, "Adding the end marker even though A is not last", "Putting ε into a FOLLOW set"],
      );
      return makeMcq(draft, `{${followTerminal}}`, [`{${firstTerminal}}`, "{$}", `{${firstTerminal}, ${followTerminal}}`]);
    }
    case 8: {
      const frames = 2 + (variant % 4);
      const references = Array.from({ length: 9 }, (_, step) => (variant * 5 + step * 3 + Math.floor(step / 2)) % 7);
      const faults = fifoFaults(references, frames);
      const draft = common(
        `fifo-${key}`,
        `A system uses FIFO page replacement with ${frames} frames. Starting with empty frames, how many page faults occur for reference string ${references.join(", ")}?`,
        "Operating Systems",
        "Memory management",
        "FIFO page replacement",
        variant,
        "NAT",
        4,
        2,
        `Simulating the references in order with ${frames} frames and evicting the oldest loaded page on each miss gives ${faults} page faults.`,
        ["Evicting the least recently used page instead of the oldest loaded page", "Counting a hit as a fault", "Forgetting that all frames start empty"],
      );
      return nat(draft, faults);
    }
    case 9: {
      const shortest = 2 + (variant % 29);
      const extra = 1 + (variant % 7);
      const draft = common(
        `bfs-${key}`,
        `In an unweighted directed graph, the only two paths from s to t contain ${shortest} and ${shortest + extra} edges, respectively. What is the shortest-path distance from s to t?`,
        "Algorithms",
        "Graph algorithms",
        "BFS shortest paths",
        variant,
        "MCQ",
        3,
        1,
        `Breadth-first search finds the minimum number of edges in an unweighted graph. Comparing the two possible path lengths gives min(${shortest}, ${shortest + extra}) = ${shortest}.`,
        ["Counting vertices rather than edges", "Returning the length of the second route instead of the minimum", "Using weighted-graph assumptions for an unweighted graph"],
      );
      return makeMcq(draft, String(shortest), [String(shortest + extra), String(shortest - 1), String(shortest + 1)]);
    }
    case 10: {
      const exponent = (variant + 1) / 10;
      const exponentText = exponent.toFixed(1);
      const comparison = exponent < 1 ? "The additive term n^c grows more slowly than n, so the recursion leaves dominate: Θ(n)." : exponent === 1 ? "The additive term matches the recursion-tree work n at each level, producing Θ(n log n)." : `Since c=${exponentText}>1, the additive term dominates and the regularity condition holds, giving Θ(n^${exponentText}).`;
      const correct = exponent < 1 ? "Θ(n)" : exponent === 1 ? "Θ(n log n)" : `Θ(n^${exponentText})`;
      const draft = common(
        `recurrence-${key}`,
        `What is the asymptotic solution of T(n) = 2T(n/2) + n^${exponentText}, with T(1) = Θ(1)?`,
        "Algorithms",
        "Asymptotic analysis",
        "Recurrences and the Master Theorem",
        variant,
        "MCQ",
        4,
        2,
        `The critical exponent is log₂2 = 1. ${comparison}`,
        ["Comparing the additive term with n instead of n^1", "Applying the regularity case when the additive exponent is smaller than one", "Forgetting the logarithmic factor at the equality case"],
      );
      return makeMcq(draft, correct, ["Θ(n)", "Θ(n log n)", exponent > 1 ? "Θ(n log n)" : "Θ(n²)", `Θ(n^${(exponent + 0.5).toFixed(1)})`]);
    }
    case 11: {
      const internal = variant + 1;
      const draft = common(
        `full-tree-${key}`,
        `A full binary tree has ${internal} internal nodes. How many leaves does it have?`,
        "Programming & Data Structures",
        "Trees",
        "Full binary tree identities",
        variant,
        "NAT",
        3,
        1,
        `In a full binary tree, every internal node has two children. If I is the number of internal nodes and L the number of leaves, L = I + 1 = ${internal + 1}.`,
        ["Using 2I as the number of leaves", "Confusing all nodes with leaf nodes", "Subtracting one from the number of internal nodes"],
      );
      return nat(draft, internal + 1);
    }
    case 12: {
      const instructions = (variant + 1) * 100;
      const stages = 2 + (variant % 8);
      const speedup = (instructions * stages) / (stages + instructions - 1);
      const draft = common(
        `pipeline-${key}`,
        `An ideal pipeline has ${stages} stages and executes ${instructions} instructions with no hazards. Using speedup = (kN)/(k+N−1), enter the speedup to two decimal places.`,
        "Computer Organization & Architecture",
        "Pipelining",
        "Pipeline speedup",
        variant,
        "NAT",
        4,
        2,
        `Substitute N=${instructions} and k=${stages}: speedup = (${stages}×${instructions})/(${stages}+${instructions}−1) = ${speedup.toFixed(2)}.`,
        ["Using k/N rather than kN/(k+N−1)", "Ignoring pipeline fill and drain time", "Using the number of instructions as the number of stages"],
      );
      return nat(draft, speedup, 2);
    }
    case 13: {
      const nodes = variant + 2;
      const leaves = Math.ceil(nodes / 2);
      const draft = common(
        `heap-leaves-${key}`,
        `A complete binary max-heap is stored in a zero-indexed array with ${nodes} occupied positions. How many nodes are leaves?`,
        "Programming & Data Structures",
        "Heaps",
        "Complete binary heap structure",
        variant,
        "NAT",
        4,
        1,
        `In a zero-indexed heap, internal nodes occupy indices 0 through floor(n/2)−1. The remaining ceil(n/2) nodes are leaves, so the count is ${leaves}.`,
        ["Using a one-indexed parent/child formula with a zero-indexed array", "Counting array positions that do not exist", "Using floor(n/2) instead of ceil(n/2) for leaves"],
      );
      return nat(draft, leaves);
    }
    default: {
      const variables = 2 + (variant % 12);
      const minterms = 2 ** variables;
      const draft = common(
        `minterms-${key}`,
        `A Boolean function has ${variables} independent binary input variables. How many distinct minterms exist over all possible input assignments?`,
        "Engineering Mathematics",
        "Discrete mathematics",
        "Boolean functions and minterms",
        variant,
        "NAT",
        3,
        1,
        `Each of the ${variables} input variables has two possible values, so there are 2^${variables} assignments and one minterm per assignment: ${minterms}.`,
        ["Using 2 × the number of variables instead of 2^n assignments", "Counting only the input variables", "Subtracting the all-zero assignment"],
      );
      return nat(draft, minterms);
    }
  }
}

/** Build an explicitly disclosed 15-template practice pack with 3,000 parameterized items. */
export function generatePracticePack(count = 3000): QuestionSeed[] {
  const safeCount = Math.min(Math.max(Math.trunc(count), 1), 3000);
  return Array.from({ length: safeCount }, (_, index) => generatedFor(index));
}
