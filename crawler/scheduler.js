class Scheduler {

    constructor() {

        this.heap = [];

    }

    size() {

        return this.heap.length;

    }

    isEmpty() {

        return this.heap.length === 0;

    }

    peek() {

        if (this.isEmpty()) return null;

        return this.heap[0];

    }

    add(task) {

        this.heap.push(task);

        this.heapifyUp();

    }

    next() {

        if (this.isEmpty()) return null;

        if (this.heap.length === 1) {

            return this.heap.pop();

        }

        const highestPriority = this.heap[0];

        this.heap[0] = this.heap.pop();

        this.heapifyDown();

        return highestPriority;

    }

    heapifyUp() {

        let index = this.heap.length - 1;

        while (index > 0) {

            const parent = Math.floor((index - 1) / 2);

            if (
                this.heap[parent].priority >=
                this.heap[index].priority
            ) {
                break;
            }

            [
                this.heap[parent],
                this.heap[index]
            ] = [
                this.heap[index],
                this.heap[parent]
            ];

            index = parent;

        }

    }

    heapifyDown() {

        let index = 0;

        const length = this.heap.length;

        while (true) {

            let largest = index;

            const left = 2 * index + 1;

            const right = 2 * index + 2;

            if (
                left < length &&
                this.heap[left].priority >
                this.heap[largest].priority
            ) {

                largest = left;

            }

            if (
                right < length &&
                this.heap[right].priority >
                this.heap[largest].priority
            ) {

                largest = right;

            }

            if (largest === index) {

                break;

            }

            [
                this.heap[index],
                this.heap[largest]
            ] = [
                this.heap[largest],
                this.heap[index]
            ];

            index = largest;

        }

    }

}

module.exports = Scheduler;